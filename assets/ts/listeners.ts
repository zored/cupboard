import {
    WallMouseDownHandler,
    CupboardPlaneMouseMoveHandler,
    CupboardMouseUpHandler,
    CupboardPlaneMouseDownHandler,
    CupboardKeyHandler,
    DoorKeyUpHandler,
    SectionWallMouseReaction,
    SectionPlaneMouseMoveHandler,
    OpenDoorMouseUpHandler,
    WoodMouseToggleHandler,
    SlideDoorPlaneMouseMoveHandler
} from "./handlers";
import {Vector3} from "three";
import {Cupboard, Sections, Section, DoorSections, Wood, SlideDoorSection, OpenDoorSection} from "./scene";
import {EventType, EventManager, ReactionCollection} from "./event";
import {Coordinate} from "./common";
import {SectionsAmountInput, SectionSizeInput} from "./form";

/**
 * Рекция секции.
 */
export class SectionReactions extends ReactionCollection{
    /**
     * Нажатиие мыши на стенке секции.
     */
    protected onWallDown:SectionWallMouseReaction;

    /**
     * Отпускаем мышь.
     */
    protected onPlaneUp:SectionWallMouseReaction;

    /**
     * Движение мыши.
     */
    protected onMove:SectionPlaneMouseMoveHandler;

    /**
     * Наведение мыши на стене.
     */
    protected onWoodHover:WoodMouseToggleHandler;

    /**
     * Поле для ввода размера.
     */
    public sizeInput:SectionSizeInput;

    constructor(protected eventManager:EventManager,
                protected section:Section,
                protected sections:Sections) {
        super();
        if (this.isInvalid()) {
            return;
        }
        this.sizeInput = new SectionSizeInput(sections, section);
        this.sizeInput.setValue(section.relativeSize * sections.getDirectionSize());

        // Задаём обработчики событий.
        this.onWallDown = new SectionWallMouseReaction(section, sections, EventType.MouseDown);

        this.onWoodHover = new WoodMouseToggleHandler(section.wood);
        this.onPlaneUp = new SectionWallMouseReaction(section, sections, EventType.MouseUp);
        this.onMove = new SectionPlaneMouseMoveHandler(section, sections, this.sizeInput);
    }

    setNextSectionListener(next:SectionReaction) {
        let nextInput = next.sizeInput;
        this.onMove.nextSizeInput = nextInput;
        this.sizeInput.setNext(nextInput);
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
            .toggle(EventType.MouseEnter, this.section.wood, this.onWoodHover, add)
            .toggle(EventType.MouseLeave, this.section.wood, this.onWoodHover, add)
            .toggle(EventType.MouseMove, this.eventManager.mouse.plane, this.onMove, add);
    }
}

/**
 * Слушатель двери.
 */
class OpenDoorListener extends SectionReaction {

    protected onWoodUp:OpenDoorMouseUpHandler;

    constructor(protected eventManager:EventManager,
                protected door:OpenDoorSection,
                protected doors:DoorSections) {
        super(eventManager, door, doors);

        // Задаём обработчики событий.
        this.onWoodUp = new OpenDoorMouseUpHandler(door, doors, EventType.MouseDown);
    }


    listen(add:boolean = true) {
        this.eventManager.toggle(EventType.MouseUp, this.door.wood, this.onWoodUp, add);
    }
}


/**
 * Слушатель двери.
 */
class SlideDoorListener extends SectionReaction {

    protected onWoodUp:OpenDoorMouseUpHandler;

    constructor(protected eventManager:EventManager,
                protected door:SlideDoorSection,
                protected doors:DoorSections) {
        super(eventManager, door, doors);
        this.onMove = new SlideDoorPlaneMouseMoveHandler(door, doors) as any as SectionPlaneMouseMoveHandler;
    }

    listen(add:boolean = true) {
        super.enable(add);
    }
}

/**
 * Слушатель для шкафа.
 */
export class CupboardHandlerSet extends ReactionCollection {
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
            .toggle(EventType.MouseMove, plane, this.planeMove, add)
            .toggle(EventType.MouseUpGlobal, null, this.globalUp, add)
            .toggle(EventType.MouseDown, plane, this.planeDown, add)
            .toggle(EventType.KeyDown, null, this.key, add)
            .toggle(EventType.KeyUp, null, this.key, add);

        for (let type of [
            EventType.KeyDown,
            EventType.KeyUp,
        ]) {
            events.toggle(type, null, this.key, add);
        }

        for (let [wall, coordinate] of this.wallToCoordinate) {
            events.toggle(EventType.MouseDown, wall, this.wallDown[coordinate], add);
        }

        for (let handler of this.wallsToggle) {
            events.toggle(EventType.MouseEnter, handler.wood, handler, add);
            events.toggle(EventType.MouseLeave, handler.wood, handler, add);
        }
    }
}