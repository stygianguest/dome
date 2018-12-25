'use strict';

import { ParametersOfJSON } from './Parameters.js';

let channelName = new URLSearchParams(window.location.search).get("channelName");
//TODO: handle the case the channelName does not exist

let channel = new BroadcastChannel(channelName);

var params;

channel.onmessage = (msg) => {
    console.log(msg.data);

    if (msg.data.action == "create") {
        params = ParametersOfJSON(msg.data.data);//JSON.parse(msg));
        document.body.appendChild(params.element);
    } else if (msg.data.action == "update") {
        params.update(msg.data.data);
    }
};

channel.postMessage({action: "request"});

//let params = new Parameters("params", "asdf");
//document.body.appendChild(params.element);
