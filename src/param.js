import { ParametersOfJSON } from './Parameters.js';
import './style.css';

document.body.classList.add("parameters");

let channelName = new URLSearchParams(window.location.search).get("channelName");
//TODO: handle the case the channelName does not exist

let channel = new BroadcastChannel(channelName);

var params;

channel.onmessage = (msg) => {
    if (msg.data.action == "create") {
        params = ParametersOfJSON(msg.data.data);
        params.channel = channel;
        document.body.appendChild(params.element);
        channel.onmessage = (msg) => { params.onBroadcastMessage(msg); };
    }
};

channel.postMessage({action: "request"});

//let params = new Parameters("params", "asdf");
//document.body.appendChild(params.element);
