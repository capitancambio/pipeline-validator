pipeline-validator
==================

A simple front end for [daisy pipeline 2](http://code.google.com/p/daisy-pipeline/) based validation scripts written in node.js.


How to get it up and running
----------------------------
1. Clone this experiment . 
2. Get (node.js)[www.nodejs.com].
3. Install the dependencies :
```
    javi@chaos:~/src/pipeline-validator$ npm -d install
```
4. Run the app:
```
    javi@chaos:~/src/pipeline-validator$ node app.js
```
5. Start the pipeline in remote mode with authentication disabled.

Caveats and limitations
-----------------------

* It's ugly.
* Currently it only works with the push-notifier branch from the pipeline framework.
* It will only work with the hauy_valid example as the xml file name is hardcoded in the server :laughing:. 
* No authenticated mode support yet.
