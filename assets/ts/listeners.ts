import {
    WallMouseDownHandler,
    CupboardPlaneMouseMoveHandler,
    CupboardMouseUpHandler,
    CupboardPlaneMouseDownHandler,
    CupboardKeyHandler,
    DoorKeyUpHandler,
    SectionWallMouseHandler,
    SectionPlaneMouseMoveHandler,
    OpenDoorMouseUpHandler, WoodMouseToggleHandler, SlideDoorPlaneMouseMoveHandler
} from "./handlers";

import {
    Vector3
} from "three";

import {
    Cupboard,
    Sections,
    Section,
    WallSections,
    ShelfSections,
    DoorSections,
    Wood,
    SlideDoorSection,
    OpenDoorSection,
} from "./scene";

import {
    EventTypeEnum,
    EventManager,
    ObjectListener
} from "./event";

import {
    Coordinate
} from "./common";

/**
 * Слушатель набора секций.
 */
export class SectionsListener extends ObjectListener {
    /**
     * Слушатели для каждого из разделов.
     *
     * @type SectionListener[]
     */
    protected listeners:SectionListener[] = [];

    /**
     * Секции
     *
     * @type Sections
     */
    protected sections:Sections;

    constructor(protected eventManager:EventManager) {
        super();
    }

    /**
     * Установить секции
     *
     * @param sections
     */
    setSections(sections:Sections) {
        this.listen(false);
        this.sections = sections;
        this.sections.getAll().forEach(this.addSectionEvent);
        this.listen(true);
        return this;
    }

    /**
     * Добавить событие для одной секции.
     *
     * @param section
     */
    protected addSectionEvent = (section:Section) => {
        // Создаём событие для секции:
        let sectionEvent = new SectionListener(this.eventManager, section, this.sections);

        // Добавляем его в массив:
        this.listeners.push(sectionEvent);
    };

    /** @inheritDoc */
    listen(add:boolean = true):void {
        this.listeners.forEach((event:SectionListener) => event.listen(add));
    }

    /**
     * Установить количество секций.
     *
     * @param amount
     */
    setAmount(amount:number) {
        this.sections.setAmount(amount);
        this.setSections(this.sections);
    }
}

/**
 * Слушатель для коллекции стен.
 */
export class WallSectionsListener extends SectionsListener {
    /**
     * Слушатели стен
     */
    protected shelfListeners:SectionsListener[];

    constructor(eventManager:EventManager) {
        super(eventManager);
    }

    /** @inheritDoc */
    setSections(sections:Sections) {
        this.shelfListeners = (sections as WallSections)
            .getShelfSections()
            .map((sections:ShelfSections) => (new SectionsListener(this.eventManager)).setSections(sections));
        super.setSections(sections);
        return this;
    }

    /** @inheritDoc */
    listen(add:boolean = true):void {
        super.listen(add);
        for (let listener of this.shelfListeners) {
            listener.listen(add);
        }
    }

    /** @inheritDoc */
    setAmount(amount:number) {
        super.setAmount(amount);
        let sections = this.sections as WallSections;
        sections.getShelfSections()
    }
}

/**
 * Слушатель коллекции дверей.
 */
export class DoorsSectionsListener extends SectionsListener {
    /**
     * Обработчик при отпускании кнопки на клавиатуре.
     */
    protected keyUp:DoorKeyUpHandler;

    constructor(eventManager:EventManager) {
        super(eventManager);

        // Заменяем событие добавления секции:
        this.addSectionEvent = (door:SlideDoorSection) => {
            // Создаём событие для секции:
            let doors = this.sections as DoorSections,
                event = new SlideDoorListener(this.eventManager, door, doors);

            // Добавляем его в массив:
            this.listeners.push(event);
        };
    }

    /** @inheritDoc */
    setSections(sections:Sections) {
        let doors = sections as DoorSections;
        this.keyUp = new DoorKeyUpHandler(doors);
        super.setSections(sections);
        return this;
    }

    /** @inheritDoc */
    listen(add:boolean = true):void {
        super.listen(add);
        this.eventManager.toggle(EventTypeEnum.KeyUp, null, this.keyUp, add);
    }
}

/**
 * Слушатель секции.
 */
class SectionListener extends ObjectListener {
    protected onWallDown:SectionWallMouseHandler;
    protected onPlaneUp:SectionWallMouseHandler;
    protected onPlaneMove:SectionPlaneMouseMoveHandler;
    protected onWoodHover:WoodMouseToggleHandler;

    constructor(protected eventManager:EventManager,
                protected section:Section,
                protected sections:Sections) {
        super();
        if (this.isInvalid()) {
            return;
        }

        // Задаём обработчики событий.
        this.onWallDown = new SectionWallMouseHandler(section, sections, EventTypeEnum.MouseDown);
        this.onWoodHover = new WoodMouseToggleHandler(section.wood);
        this.onPlaneUp = new SectionWallMouseHandler(section, sections, EventTypeEnum.MouseUp);
        this.onPlaneMove = new SectionPlaneMouseMoveHandler(section, sections);
    }

    /**
     * Содержимое некорректное
     *
     * @returns {boolean}
     */
    protected isInvalid() {
        return !this.section.wood;
    }

    listen(add:boolean = true) {
        if (this.isInvalid()) {
            return;
        }
        this.eventManager
            .toggle(this.onWallDown.eventType, this.section.wood, this.onWallDown, add)
            .toggle(this.onPlaneUp.eventType, this.eventManager.mouse.plane, this.onPlaneUp, add)
            .toggle(EventTypeEnum.MouseEnter, this.section.wood, this.onWoodHover, add)
            .toggle(EventTypeEnum.MouseLeave, this.section.wood, this.onWoodHover, add)
            .toggle(EventTypeEnum.MouseMove, this.eventManager.mouse.plane, this.onPlaneMove, add);
    }
}

/**
 * Слушатель двери.
 */
class OpenDoorListener extends SectionListener {

    protected onWoodUp:OpenDoorMouseUpHandler;

    constructor(protected eventManager:EventManager,
                protected door:OpenDoorSection,
                protected doors:DoorSections) {
        super(eventManager, door, doors);

        // Задаём обработчики событий.
        this.onWoodUp = new OpenDoorMouseUpHandler(door, doors, EventTypeEnum.MouseDown);
    }


    listen(add:boolean = true) {
        this.eventManager.toggle(EventTypeEnum.MouseUp, this.door.wood, this.onWoodUp, add);
    }
}


/**
 * Слушатель двери.
 */
class SlideDoorListener extends SectionListener {

    protected onWoodUp:OpenDoorMouseUpHandler;

    constructor(protected eventManager:EventManager,
                protected door:SlideDoorSection,
                protected doors:DoorSections) {
        super(eventManager, door, doors);
        this.onPlaneMove = new SlideDoorPlaneMouseMoveHandler(door, doors) as any as SectionPlaneMouseMoveHandler;
    }
    
    listen(add:boolean = true) {
        super.listen(add);
    }
}

/**
 * Слушатель для шкафа.
 */
export class CupboardListener extends ObjectListener {
    protected wallDown:WallMouseDownHandler[] = [];
    protected planeMove:CupboardPlaneMouseMoveHandler;
    protected globalUp:CupboardMouseUpHandler;
    protected planeDown:CupboardPlaneMouseDownHandler;
    protected wallsToggle:WoodMouseToggleHandler[] = [];
    protected key:CupboardKeyHandler;
    public changingSize:Vector3 = new Vector3();
    public previousSize:Vector3;
    public resizeStartPoint:Vector3;
    protected wallToCoordinate:[Wood, Coordinate][];

    constructor(protected cupboard:Cupboard, protected eventManager:EventManager) {
        super();
        for (var i = 0; i < 3; i++) {
            this.wallDown[i] = new WallMouseDownHandler(this, cupboard, i);
        }
        this.planeMove = new CupboardPlaneMouseMoveHandler(this, this.cupboard);
        this.globalUp = new CupboardMouseUpHandler(this, this.cupboard);
        this.planeDown = new CupboardPlaneMouseDownHandler(this, this.cupboard);
        this.key = new CupboardKeyHandler(this, this.cupboard);
        this.wallToCoordinate = [
            [cupboard.walls.right, Coordinate.X],
            [cupboard.walls.bottom, Coordinate.Y],
            [cupboard.walls.left, Coordinate.Z],
            [cupboard.walls.top, Coordinate.Z],
        ];
        for (let [wall] of this.wallToCoordinate) {
            this.wallsToggle.push(new WoodMouseToggleHandler(wall));
        }
    }

    listen(add:boolean = true) {
        let events = this.eventManager;

        // Невидимая огромная плоскость
        let plane = events.mouse.plane;

        events
            .toggle(EventTypeEnum.MouseMove, plane, this.planeMove, add)
            .toggle(EventTypeEnum.MouseUpGlobal, null, this.globalUp, add)
            .toggle(EventTypeEnum.MouseDown, plane, this.planeDown, add)
            .toggle(EventTypeEnum.KeyDown, null, this.key, add)
            .toggle(EventTypeEnum.KeyUp, null, this.key, add);

        for (let type of [
            EventTypeEnum.KeyDown,
            EventTypeEnum.KeyUp,
        ]) {
            events.toggle(type, null, this.key, add);
        }

        for (let [wall, coordinate] of this.wallToCoordinate) {
            events.toggle(EventTypeEnum.MouseDown, wall, this.wallDown[coordinate], add);
        }

        for (let handler of this.wallsToggle) {
            events.toggle(EventTypeEnum.MouseEnter, handler.wood, handler, add);
            events.toggle(EventTypeEnum.MouseLeave, handler.wood, handler, add);
        }
    }
}