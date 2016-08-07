import * as $ from "jquery";
import {ObjectSizeInputHandler, SectionAmountInputHandler, SectionSizeInputHandler} from "./handlers";
import {Cupboard, Section, Sections} from "./scene";
import {Coordinate} from "./common";
import {SectionsReactionCollection} from "./listeners";
import Object3D = THREE.Object3D;
import {AbstractReactions} from "./event";

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
        this.setValue(object.scale.getComponent(index))
    }

    /**
     * Создать обработчик.
     *
     * @returns {ObjectSizeInputHandler}
     */
    protected createHandler() {
        return new ObjectSizeInputHandler(this.object, this.index);
    }

    /** @inheritDoc */
    protected setName(name:string) {
        this.name = this.prefix + ' ' + this.name;
        super.setName(name);
        return this;
    }
}

/**
 * Поле для ввода размера раздела.
 */
export class SectionSizeInput extends ObjectSizeInput {
    constructor(protected sections:Sections, protected section:Section) {
        super(section, sections.direction);
        this.handler = new SectionSizeInputHandler(this.sections, this.section, this.index);
    }

    /**
     * Установить следующее поле ввода размера раздела.
     * @param next
     */
    setNext(next:SectionSizeInput) {
        (this.handler as SectionSizeInputHandler).setNext(next);
    }
}

/**
 * Поле для ввода размера шкафа.
 */
class CupboardSizeInput extends ObjectSizeInput {
    constructor(cupboard:Cupboard, index:Coordinate) {
        super(cupboard, index);
        this.setValue(cupboard.size.getComponent(index));
    }
}

/**
 * Поле для ввода количества секций.
 */
export class SectionsAmountInput extends NumberInput {
    constructor(sectionsListener:SectionsReactionCollection) {
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
    /** @inheritDoc */
    set(value:any) {
        value = parseInt(value);
        super.set(value);
        return this;
    }

    /** @inheritDoc */
    get():number {
        return parseInt(super.get());
    }
}

/**
 * Форма.
 * Содержит инпуты.
 */
class Form {
    protected inputs:Input[];
    public element:JQuery;

    constructor(protected name) {
        this.element = this.createElement();
    }

    /**
     * Добавить инпут.
     *
     * @param input
     * @returns {Form}
     */
    protected addInput(input:Input) {
        this.inputs.push(input);
        this.getInputsHolder().append(input.element);
        return this;
    }

    /**
     * Создать элемент формы.
     *
     * @returns {JQuery}
     */
    protected createElement() {
        return $(`
            <div>
                <div class="head">${this.name}</div>
                <div class="inputs"></div>
            </div>
        `)
    }

    /**
     * Получить элемент для хранения инпутов.
     *
     * @returns {JQuery}
     */
    protected getInputsHolder() {
        return this.element.find('.inputs');
    }
}

/**
 * Форма ввода размеров шкафа.
 */
class CupboardForm extends Form {
    constructor(protected cupboard:Cupboard) {
        super('Шкаф');

        for (var i = 0; i < 3; i++) {
            this.addInput((new CupboardSizeInput(cupboard, i)));
        }
    }

}