'use strict';

function makeRandomIdentifier(length, possible="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789") {
  var text = "";

    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function makeParamURL(channelName) {
  let paramURL = new URL(document.location.href);
  paramURL.pathname = "dist/param.html";
  //let searchParams = new URLSearchParams(paramURL.search);
  paramURL.searchParams.set("channelName", channelName);
  return paramURL;
}

class Parameter {
    //TODO: should probably be called Field (as in struct-field) because
    //      parameter is too broad/something different
    constructor(type, id, getValue, setValue, args) {
        this.type = type;
        this.id = id;
        this.getValue = getValue;
        this.setValue = setValue;
        this.args = args;
    }

    toJSON() {
        return { "type": this.type, "id": this.id, "value": this.getValue(), "args": this.args };
    }

    update(json) {
        this.setValue(json.value);
    }
}

export class Parameters {

    constructor(id, title="", onchange=(c) => {}, superSection=null) {
        this.broadcastID = makeRandomIdentifier(16);
        this.superSection = superSection;
        this.id = id;
        this.title = title;
        this.parameters = new Map();

        this.element = document.createElement("div");

        if (id != "" || title != "") {
            let titleElement = document.createElement("div");
            titleElement.innerText = title || id;
            this.element.appendChild(titleElement);
        }

        if (this.superSection == null) {
            //this.channelName = makeRandomIdentifier(8);
            this.channelName = "asdf";
            this.channel = new BroadcastChannel(this.channelName);
            this.channel.onmessage = (msg) => { this.onBroadcastMessage(msg); };

            let detach = document.createElement("a");
            detach.innerText = "detach";
            detach.href = makeParamURL(this.channelName);
            detach.target = "_blank"; // open in new window
            detach.onclick = () => { this.detach(); };

            this.onchange = (c) => {
                let change = {id, parameters: [c]};
                onchange(change);
                this.channel.postMessage({action: 'update', sender: this.broadcastID, data: change});
            };

            this.element.appendChild(detach);
        } else {
            this.onchange = (c) => {
                this.superSection.onchange({id, parameters: [c]});
            };
        }

        this.element.id = id;
    }

    detach() {
        //window.open(makeParamURL(this.channelName), "_blank", 
        //    "location=yes,height=600,width=300,scrollbars=yes,status=no");
    }

    float(id, value=0., step=0.1, min=null, max=null, description="") {
        let elem = document.createElement("div");
        this.element.appendChild(elem);

        let labelElem = elem.appendChild(document.createElement("label"));
        labelElem.innerText = `${id} = `;

        let inputElem = elem.appendChild(document.createElement("input"));
        inputElem.id = `${this.element.id}/${id}`;

        labelElem.htmlFor = inputElem.id;

        inputElem.type = "number";
        inputElem.value = value;
        inputElem.step = step;
        if (min != null) inputElem.min = min;
        if (max != null) inputElem.max = max;
        inputElem.description = description;

        inputElem.onchange = () => {
            this.onchange({id, 'value': parseFloat(inputElem.value)})
        };
            
        let get = () => { return parseFloat(inputElem.value); };
        let set = (value) => { inputElem.value = value; };

        Object.defineProperty(this, id, {
            get,
            set(value) {
                set(value);
                this.onchange({id, value});
            },
        });

        this.parameters.set(id, new Parameter("float", id, get, set, [step, min, max, description]));

        return this[id];
    }

    section(id, title="") {
        let subSection = new Parameters(id, title || id, this.onchange, this);
        this.parameters.set(id, subSection);

        this.element.appendChild(subSection.element);

        Object.defineProperty(this, id, {
            value: subSection,
            writable: true
        });
        
        return subSection;
    }

    choice(id, value, choices, label="") {
        let element = document.createElement("div");
        element.id = `${id}-group`;

        let labelElem = document.createElement("div");
        labelElem.innerText = label || id;
        element.appendChild(labelElem);
      
        let buttons = []
        for (let choice of choices) {
            let button = document.createElement("input");
            button.type = "radio";
            button.name = `${this.element.id}/${id}`;
            button.id = `${button.name}-${buttons.length}`;
            button.checked = buttons.length == value || choice == value;
            button.onchange = () => {
                this.onchange({id, value: this[id]})
            };

            let label = document.createElement("label");
            label.innerText = choice;
            label.htmlFor = button.id;

            element.appendChild(button);
            element.appendChild(label);

            buttons.push(button);
        }

        let get = () => {
            let i = 0;
            for (let button of buttons) {
                if (button.checked) {
                    return choices[i];
                }
                i++;
            }

            return "";
        };

        let set = (v) => {
            let i = choices.indexOf(v);
            let j = 0;
            for (let button of buttons) {
                buttons[j].checked = i == j;
                j++;
            }
        };

        Object.defineProperty(this, id, {
            get,
            set(v) {
                set(v);
                this.onchange({id, value: i})
            }
        });

        this.element.appendChild(element);

        this.parameters.set(id, new Parameter("choice", id, get, set, [choices, label]));

        return element;
    }

    toJSON() {
        return {
            "type": "section",
            "id": this.id,
            "value": this.title,
            "args":[],
            "parameters": Array.from(this.parameters.values()).map((p) => p.toJSON())
        };
    }

    onBroadcastMessage(msg) {
        if (msg.data.sender == this.broadcastID) {
            // ignore messages from self
            return;
        }

        if (msg.data.action == "request") {
            //TODO: should only answer the request if I'm the original?
            this.channel.postMessage({action: "create", sender: this.broadcastID, data: this.toJSON()});

        } else if (msg.data.action == "update") {

            this.update(msg.data.data);
        }
    }

    update(json) {

        for (let p of json.parameters) {
            this.parameters.get(p.id).update(p);
        }

        //TODO: onupdate(json);
    }

}

export function ParametersOfJSON(json) {
    let addParameters = function(section, parameters) {
        for (let p of parameters) {
            let addedParameter = section[p.type](p.id, p.value, ...p.args);

            if (p.type == "section") {
                addParameters(addedParameter, p.parameters);
            }
        }
    };

    if (json.type == "section") {
        let section = new Parameters(json.id, json.value);
        addParameters(section, json.parameters);
        
        return section;
    }

    return null;// throw error?
}

