'use strict';

export default class {

    constructor(id="", onchange=(x, v) => {}) {
        this.element = document.createElement("div");
        this.element.id = id;
        this.onchange = onchange;
    }

    float(id, value=0., step=0.1, min=null, max=null, description="") {
        let elem = document.createElement("div");
        this.element.appendChild(elem);

        let labelElem = elem.appendChild(document.createElement("label"));
        labelElem.innerText = `${id} = `;

        let inputElem = elem.appendChild(document.createElement("input"));
        inputElem.id = id;
        inputElem.type = "number";
        inputElem.value = value;
        inputElem.step = step;
        if (min != null) inputElem.min = min;
        if (max != null) inputElem.max = max;
        inputElem.description = description;

        inputElem.onchange = () => {
            this.onchange(id, parseFloat(inputElem.value))
        };

        Object.defineProperty(this, id, {
            get() { return parseFloat(inputElem.value); },
            set(v) {
                inputElem.value = v;
                this.onchange(id, v);
            },
        });

        return this[id];
    }

};
