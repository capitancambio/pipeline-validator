//Imports
var express = require('express');
var http = require('http');
var app = express();
var request = require('request');
var zip=require('adm-zip');
var fs=require('fs');
var url=require('url');
var et = require('elementtree');
var freeport=require('freeport');
var util=require('util');
var crypto=require('crypto');

var moment=require('moment');
//start server and socket.io
var server = http.createServer(app);
var io = require('socket.io').listen(server);

String.prototype.rjust = function( width, padding ) {
	padding = padding || " ";
	padding = padding.substr( 0, 1 );
	if( this.length < width )
		return padding.repeat( width - this.length ) + this;
	else
		return this;
};

String.prototype.repeat = function( num ) {
	for( var i = 0, buf = ""; i < num; i++ ){
		buf += this;
	}
	return buf;
};
//Configuration, move this to a external json file
conf={};
conf.pipeline="http://localhost:8182/ws/";
conf.validator="dtbook-validator";
conf.listener="http://localhost";
conf.client="clientid";
conf.secret="supersecret";


app.use(express.bodyParser());

//start main sever
server.listen(8080);
//websocks
io.sockets.on('connection', function (socket) {
	console.log('connected!');
});

// routing
app.get('/', function (req, res) {
	res.sendfile(__dirname + '/index.html');
 });

app.post('/validate',function(req,res){
	//pipeline communication
	//find a free port to listen
	freeport(function (err,port){ 
		if (err){
			console.error('Error getting port for push notification',err);
			return;
		}
		console.info("Adquired port:%s",port);
		//builds the xml request representation
		buildJobRequest(port,function(xml){
			//sends the request and listens for changes
			jobListner(xml,req.files.test.path,port);
		});
	});
	res.sendfile(__dirname + '/validate.html');
});



function jobListner(xmlreq,path,port){
	//creates a server to listen to the pipeline
	var server=http.createServer(function(request, response) {
		if (request.method == 'POST') {
			data="";
			request.on('data', function(chunk) {
				console.log(chunk.toString());
				data+=chunk.toString();
			});
			request.on('end', function() {
			
				var job=jobFromXml(data);	
				console.log("STATUS:"+job.status);
				//send the status to the ui
				io.sockets.emit('status',job.status);
				if(job.status=="DONE"){
					//get the report
					fetchResult( job.id, function(report){
						io.sockets.emit('report',report);
					});
					//close
					server.close(function(){
						console.info("Closing server on %s:",port);
					});

				}else if(job.status=="ERROR"){//if err close the server
					server.close(function(){
						console.info("Closing server on %s:",port);
					});
				}
			});
			console.log("[200] " + request.method + " to " + request.url);
		}
		//empty result is returned to the pipeline
		response.writeHead(200, {"Content-Type": "text/plain"});
		response.end();
	});
	server.listen(port);
	sendJob(xmlreq,path);
}


function fetchResult(id,forward){
	//http://localhost:8182/ws/jobs/3077abc1-8f9e-4332-8dfe-dc4828d2863b/result/port/html-report/idx/html-report/html-report.xml
	console.log('fetching result');	
	var uri=conf.pipeline+'jobs/'+id+'/result/port/html-report/idx/html-report/html-report.xml';
	uri=authenticate(uri);
	var req=request.get(uri,function (error,response,body){
		if(error){
			console.log("Error getting report");	
		}if(response.statusCode==200){
			forward(body);
		}
	});
}

function jobFromXml(xml){
	var tree=et.parse(xml);	
	var job={id:tree.getroot().attrib.id,status:tree.getroot().attrib.status};	
	return job;
}

function sendJob(xmlreq,path){
	var url=authenticate(conf.pipeline+'jobs');
	var req=request.post(url,function(error,response,body){

		if(error){
			console.log('Error sending job: %s',error);
			return;
		}
		console.log('res code: ',response.statusCode);
		if (!error && response.statusCode == 201) {
			console.log('Job id: '+jobFromXml(body).id); 
		}
			
	});
	var form=req.form();
	form.append('job-data',fs.createReadStream(path));
	form.append('job-request',xmlreq);
}

function authenticate(url){
	if ("client" in conf && "secret" in conf){
		console.log("authenticating");
		var client=conf.client;
		var secret=conf.secret;
		var time=moment().format('YYYY-MM-DD[T]HH:mm:ss[Z]');
		var nonce = String(Math.floor(Math.random()*Math.pow(2,31))).rjust(30,"0");
		var args=url+"?authid="+client+"&time="+time+"&nonce="+nonce;
		var hash=crypto.createHmac('sha1',secret);
		hash.update(args);
		var sum=hash.digest('base64');
		args+="&sign="+sum;
		console.log(args);
		return args;
	}else{
		return url;
	}


}
function buildJobRequest(port, listener ){
	//var file= new zip(req.files.test.path);
	//file.getEntries().forEach(function (entry){
		//console.log(entry.toString());
	//});
	var ElementTree = et.ElementTree;
	var element = et.Element;
	var subElement = et.SubElement;
	root = element('jobRequest');
	root.set('xmlns', 'http://www.daisy.org/ns/pipeline/data');

	script=subElement(root,'script');
	script.attrib.href=conf.pipeline+"scripts/"+conf.validator;
	
	input=subElement(root,'input');
	input.attrib.name="source";
	//set this using attribute
	sourcePath=subElement(input,"item");
	sourcePath.attrib.value="./hauy_valid.xml";

	callback=subElement(root,"callback");
	callback.attrib.type="status";
	callback.attrib.href=conf.listener+":"+port+"/jobstatus";

	etree=  new ElementTree(root);
	console.log(etree.write());
	listener(etree.write());
}
