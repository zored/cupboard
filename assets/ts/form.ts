import * as $ from "jquery";
import {CupboardSizeInputHandler, SectionAmountInputHandler} from "./handlers";
import {Cupboard} from "./scene";
import {Coordinate} from "./common";
import {SectionsListener} from "./listeners";

abstract class Input {
    public element:JQuery;
    public input:JQuery;
    public handler:InputHandler;
    /**
     * Функция запускает обработчик.
     */
    protected launchHandler = () => {
        this.handler.handle(this.getValue());
    };

    constructor(protected name:string = '') {
        this.element = this.createElement();
        this.input = this.createInput();
        this.appendInput();
        this.listen();
        // XXX
        $('body').append(this.element);
    }

    protected listen(){
        this.element.on({
            change: this.launchHandler,
            keyup: this.launchHandler
        });
    }

    
    protected getValue():InputValue{
        return this.createValue().set(this.getValueFromElement());
    }
    
    protected createValue():InputValue{
        return new InputValue();
    }
    
    protected getValueFromElement():any{
        return this.input.val();
    }

    protected appendInput(){
        this.element.find('.holder').append(this.input);
    }

    protected createElement(){
        return $(`
            <div class="input">
                <div class="name">${this.name}</div>
                <div class="holder"></div>
            </div>
        `);
    }

    protected createInput() {
        return $('<input type="text"/>');
    }

    setValue(value:any) {
        let parsedValue = this.createValue().set(value).get();
        this.input.val(parsedValue);
    }
}

class NumberInput extends Input {
    protected createValue():InputValue {
        return super.createValue();
    }
}

/**
 * Обработчик действий полей ввода форм.
 */
export abstract class InputHandler {
    /**
     * Обработать событие.
     *
     * @param value
     */
    public abstract handle(value:InputValue):void;
}


export class CupboardSizeInput extends NumberInput{
    constructor(cupboard:Cupboard, index:Coordinate) {
        let names = ['Ширина', 'Высота', 'Глубина'];
        super(names[index]);
        this.handler = new CupboardSizeInputHandler(cupboard, index);
    }
}

export class SectionsAmountInput extends NumberInput{
    constructor(prefix:string, sectionsListener:SectionsListener) {
        super('Количество ' + prefix);
        this.handler = new SectionAmountInputHandler(sectionsListener);
    }
}

export class InputValue{
    constructor(protected value:any = null) {
        this.set(value);
    }
    
    set(value:any){
        this.value = value;
        return this;
    }
    
    get():any{
        return this.value;
    }
}

export class IntValue extends InputValue{
    set(value:any){
        value = parseInt(value);
        super.set(value);
        return this;
    }

    get():number {
        return parseInt(super.get());
    }
}