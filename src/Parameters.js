'use strict';

class Parameters {

    constructor(id, title="", onchange=(x, v) => {}) {
        this.element = document.createElement("div");

        if (id != "" || title != "") {
            let titleElement = document.createElement("div");
            titleElement.innerText = title || id;
            this.element.appendChild(titleElement);
        }

        this.element.id = id;
        this.onchange = onchange;
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

    subsection(id, title="") {
        let subSection = new Parameters(`${this.element.id}/${id}`, title || id, this.onchange);

        this.element.appendChild(subSection.element);

        Object.defineProperty(this, id, {
            value: subSection,
            writable: true
        });
        
        return subSection;
    }

    choice(id, choices, value=-1, label="") {
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
            button.checked = buttons.length == value;
            button.onchange = () => {
                this.onchange(id, this[id])
            };

            let label = document.createElement("label");
            label.innerText = choice;
            label.htmlFor = button.id;

            element.appendChild(button);
            element.appendChild(label);

            buttons.push(button);
        }

        Object.defineProperty(this, id, {
            get() {
                let i = 0;
                for (let button of buttons) {
                    if (button.checked) {
                        return choices[i];
                    }
                    i++;
                }

                return "";
            },
            set(v) {
                let i = choices.indexOf(v);
                let j = 0;
                for (let button of buttons) {
                    buttons[j].checked = i == j;
                    j++;
                }
                this.onchange(id, i)
            }
        });

        this.element.appendChild(element);

        return element;
    }

};

export default Parameters;

