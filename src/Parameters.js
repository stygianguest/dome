'use strict';

import './style.css';

function makeRandomIdentifier(length, possible="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789") {
  var text = "";

    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function makeParamURL(channelName) {
  let paramURL = new URL(document.location.href);
  paramURL.pathname = "param.html";
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
        // important that this one does not cause updates to be broadcast
        this.setValue(json.value);
    }
}

export class Parameters {

    constructor(id, onchange=(c) => {}, superSection=null) {
        this.broadcastID = makeRandomIdentifier(16);
        this.superSection = superSection;
        this.id = id;
        this.parameters = new Map();
        this.onchange = onchange;

        this.element = document.createElement("div");
        this.element.classList.add('parameterStruct');

        if (this.superSection == null) {
            this.element.classList.add('parameters');

            let titleElement = document.createElement("div");
            titleElement.classList.add('parametersTitle');
            titleElement.innerText = id;
            this.element.appendChild(titleElement);

            let detach = document.createElement("a");
            detach.style.float = 'right';
            detach.classList.add("icon");
            detach.innerText = "⇱";
            detach.href = '#';
            detach.onclick = () => { this.detach(); };

            titleElement.appendChild(detach);

            this.channelName = makeRandomIdentifier(8);
            this.channel = new BroadcastChannel(this.channelName);
            this.channel.onmessage = (msg) => { this.onBroadcastMessage(msg); };
        }

        this.element.id = id;

        this.dl = document.createElement('dl');
        this.element.appendChild(this.dl);
    }

    detach() {
        let width = Math.max(200, this.element.clientWidth);
        let height = Math.max(300, this.element.clientHeight);

        window.open(makeParamURL(this.channelName), "_blank", 
            `location=yes,height=${height},width=${width},scrollbars=yes,status=no`);

        //TODO: we would like to do this, but then we have to also notify
        //      reattach on close, or else we lose control
        //this.element.style.display = 'none';
    }

    float(id, value=0., step=0.1, min=null, max=null, description="") {
        let dt = this.dl.appendChild(document.createElement("dt"));
        let labelElem = dt.appendChild(document.createElement("label"));
        labelElem.innerText = id;
        labelElem.classList.add('parameterFieldLabel');
        
        let dd = this.dl.appendChild(document.createElement("dd"));
        let inputElem = dd.appendChild(document.createElement("input"));
        inputElem.id = `${this.element.id}/${id}`;
        inputElem.classList.add('parameterFieldInput');

        labelElem.htmlFor = inputElem.id;

        inputElem.type = "number";
        inputElem.value = value;
        inputElem.step = step;
        if (min != null) inputElem.min = min;
        if (max != null) inputElem.max = max;
        inputElem.description = description;

        inputElem.onchange = () => {
            this.onchange({id, value});
            this.broadcastUpdate({id, 'value': parseFloat(inputElem.value)})
        };
            
        let get = () => { return parseFloat(inputElem.value); };
        let set = (value) => {
            inputElem.value = value;
            this.onchange({id, value});
        };

        Object.defineProperty(this, id, { 
            get, 
            set(value) {
                set(value);
                this.broadcastUpdate({id, value});
            }
        });

        this.parameters.set(id, new Parameter("float", id, get, set, [step, min, max, description]));

        return this[id];
    }

    section(id, title="") {
        //TODO: rename to struct

        let subSection = new Parameters(id, this.onchange, this);
        this.parameters.set(id, subSection);

        let dt = this.dl.appendChild(document.createElement("dt"));
        dt.innerText = title || id;

        let dd = this.dl.appendChild(document.createElement("dd"));
        dd.appendChild(subSection.element);

        Object.defineProperty(this, id, {
            value: subSection,
            writable: true
        });
        
        return subSection;
    }

    enum(id, value, choices) {
        let dt = this.dl.appendChild(document.createElement("dt"));
        dt.classList.add('parameterFieldLabel');
        dt.innerText = id;

        let dd = this.dl.appendChild(document.createElement("dd"));
        let select = dd.appendChild(document.createElement("select"));
        select.classList.add('parameterFieldInput');
        select.id = id;

        for (let choice of choices) {
            let option = select.appendChild(document.createElement("option"));
            option.value = choice;
            option.innerText = choice;
        }

        select.value = value;

        select.onchange = () => {
            this.onchange({id, value: select.value})
            this.broadcastUpdate({id, value: select.value})
        };

        let get = () => {
            return select.value;            
        };

        let set = (value) => {
            select.value = value;
            this.onchange({id, value})
        };

        Object.defineProperty(this, id, { 
            get, 
            set(value) {
                set(value);
                this.broadcastUpdate({id, value});
            }
        });

        this.parameters.set(id, new Parameter("enum", id, get, set, [choices]));
    }

    choice(id, value, choices, label="") {
        //TODO: rework to make these into tabs with effectively a variant type
        //      for the tabs see e.g. https://codepen.io/istavros/pen/hiuvF
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
                this.broadcastUpdate({id, value: this[id]})
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
            this.onchange({id, value: i})
        };

        Object.defineProperty(this, id, { 
            get, 
            set(value) {
                 set(value);
                this.broadcastUpdate({id, value});
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

    broadcastUpdate(change) {
        if (this.superSection == null) {
            this.channel.postMessage( {
                action: 'update',
                sender: this.broadcastID,
                data: {id: this.id, parameters: [change]}
            });
        } else {
            this.superSection.broadcastUpdate({id: this.id, parameters: [change]});
        }
    }

    update(json) {
        for (let p of json.parameters) {
            this.parameters.get(p.id).update(p);
        }
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

