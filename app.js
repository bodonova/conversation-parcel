/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var requestify = require('requestify');
var bodyParser = require('body-parser'); // parser for post requests
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk

var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

// Create the service wrapper
var conversation = new Conversation({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  // username: '<username>',
  // password: '<password>',
  // url: 'https://gateway.watsonplatform.net/conversation/api',
  version_date: Conversation.VERSION_DATE_2017_04_21
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  // console.log ('Message Input: '+JSON.stringify(req.body));
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };

  // Send the input to the conversation service
  conversation.message(payload, function(err, data) {
    // console.log ('Conversation Response: '+JSON.stringify(data));
    if (err) {
      return res.status(err.code || 500).json(err); // the converstion service returned an error
    }
    var parcel_num = data.context.parcel_num;
    if (data.intents && (data.intents.length>0) && data.intents[0].intent && (data.intents[0].intent === 'parcel') && parcel_num) {
      // console.log ('This is a parcel tracking request for parcel '+parcel_num);

      // we make a rest call to ourselves to find the parcel location to put in the response
      var server = 'localhost';
      var port = process.env.PORT || process.env.VCAP_APP_PORT || 3000;
      var url = 'http://' + server + ':' + port +'/api/parcel?parcel_num='+parcel_num;
      // console.log ('getting parcel location from  '+url);
      requestify.get(url)
        .then(function(response) {
          var location = response.body;
          // console.log ('parcel service response : '+response.body);
          // console.log ('original response: '+data.output.text[0]);
          data.output.text[0] = data.output.text[0].replace( /\{0\}/g, location);
          // console.log ('updated to: '+data.output.text[0]);
          return res.json(data);
        })
        .catch(function(err){
          // console.log ("Error "+err.code+" = "+err.body);
          data.output.text[0] = "Parcel lookup service returned an error: "+err.body;
          return res.json(data);
        });
    } else {
      return res.json(data);
    }
  });
});

/**
 * A dummy parcel tracking service
 */
 app.get('/api/parcel', function(req, res) {
   var parcel_num = parseInt(req.query.parcel_num);
  //  console.log ('PARCEL getting a location for '+parcel_num);
   if (!req.query.parcel_num || isNaN(parcel_num)) {
    //  console.log ('PARCEL Not a valid number ');
     return res.status(400).end("Not a valid parcel number " + req.query.parcel_num );
   }
   if (0 == (parcel_num %13)) {
    //  console.log ('PARCEL number divisible by 13 is unlucky')
     return res.status(404).end("We can't find parcel number " +parcel_num+" it is unlucky!");
   }

   var locations = [
     'Anfield', 'Stamford Bridge', 'Old Trafford', 'Parkhead',
     'Hatfield, UK',
     'Heathrow Airport', 'Westminister, London', 'Buckingham Palace',
     'Lands End, Cornwall', 'John O\'Groats'
   ];

   parcel_num = parcel_num % locations.length;
   var location  = locations[parcel_num];
  //  console.log ('PARCEL matched address '+parcel_num+': '+location);
   res.end(location);
});

module.exports = app;
