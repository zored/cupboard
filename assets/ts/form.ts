import * as $ from "jquery";
import {ObjectSizeInputHandler, SectionAmountInputHandler, SectionSizeInputHandler} from "./handlers";
import {Cupboard, Section, Sections} from "./scene";
import {Coordinate} from "./common";
import {SectionsListener} from "./listeners";
import Object3D = THREE.Object3D;

export abstract class Input {
    public element:JQuery;
    public input:JQuery;
    public handler:InputHandler;
    /**
     * Функция запускает обработчик.
     */
    protected launchHandler = () => {
        this.handler.handle(this.getValue());
    };

    /**
     * Установить название.
     *
     * @param name
     */
    protected setName(name:string) {
        this.name = name;
        this.getNameHolder().text(name);
        return this;
    }

    protected getNameHolder():JQuery {
        return this.element.find('.name');
    }

    constructor(protected name:string = '') {
        this.element = this.createElement();
        this.input = this.createInput();
        this.appendInput();
        this.listen();
        // XXX
        $('body').append(this.element);
    }

    protected listen() {
        this.element.on({
            change: this.launchHandler,
            keyup: this.launchHandler
        });
    }


    protected getValue():InputValue {
        return this.createValue().set(this.getValueFromElement());
    }

    protected createValue():InputValue {
        return new InputValue();
    }

    protected getValueFromElement():any {
        return this.input.val();
    }

    protected appendInput() {
        this.element.find('.holder').append(this.input);
    }

    protected createElement() {
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
        return new IntValue();
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

/**
 * Поле для ввода размера шкафа.
 */
export class ObjectSizeInput extends NumberInput {
    protected prefix:string;
    constructor(public object:Object3D, protected index:Coordinate) {
        super('');
        let names = ['Ширина', 'Высота', 'Глубина'];
        this.prefix = names[index];
        this.setName('');
        this.handler = this.createHandler();
    }
    
    protected createHandler(){
        return new ObjectSizeInputHandler(this.object, this.index);
    }

    protected setName(name:string) {
        this.name = this.prefix + ' ' + this.name;
        super.setName(name);
        return this;
    }
}

/**
 * Поле для ввода размера шкафа.
 */
export class SectionSizeInput extends ObjectSizeInput {
    constructor(protected sections:Sections, protected section:Section) {
        super(section, sections.direction);
        this.handler = new SectionSizeInputHandler(this.sections, this.section, this.index);
    }

    setNext(next:SectionSizeInput) {
        (this.handler as SectionSizeInputHandler).setNext(next);
    }
}

/**
 * Поле для ввода количества секций.
 */
export class SectionsAmountInput extends NumberInput {
    constructor(sectionsListener:SectionsListener) {
        super(null);
        this.handler = new SectionAmountInputHandler(sectionsListener);
    }

    setPrefix(prefix:string) {
        this.setName('Количество ' + prefix);
        return this;
    }
}

/**
 * Значение поля ввода.
 */
export class InputValue {
    constructor(protected value:any = null) {
        this.set(value);
    }

    /**
     * Установить значение.
     *
     * @param value
     * @returns {InputValue}
     */
    set(value:any) {
        this.value = value;
        return this;
    }

    /**
     * Получить значение.
     *
     * @returns {any}
     */
    get():any {
        return this.value;
    }
}

/**
 * Целочисленное значение.
 */
export class IntValue extends InputValue {
    set(value:any) {
        value = parseInt(value);
        super.set(value);
        return this;
    }

    get():number {
        return parseInt(super.get());
    }
}