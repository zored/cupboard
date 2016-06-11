import {
    EventData, 
    MouseEventData, 
    KeyBoardEventData, 
    EventHandler,
    EventTypeEnum,
    KeyCodeEnum
} from "./event";

import {
    Cupboard,
    Section,
    Sections,
    DoorSection,
    DoorSections
} from "./scene";

import {
    Vector3
} from "three";

import {
    CupboardListener
} from "./listeners";

/**
 * Обработчик событий для шкафа.
 */
abstract class CupboardHandler extends EventHandler {
    constructor(protected mouseEvents:CupboardListener, protected cupboard:Cupboard) {
        super();
    }
}

/**
 * Обработчик движения мыши по плоскости для шкафа.
 */
export class CupboardPlaneMouseMoveHandler extends CupboardHandler {
    handle(data:MouseEventData) {
        let point = data.getPlaneIntersection().point;

        for (let index = 0; index < 3; index++) {
            this.changeComponent(index, point);
        }
    }

    protected changeComponent(index:number, point:Vector3) {
        if (!this.mouseEvents.changingSize.getComponent(index)) {
            return;
        }

        // Получаем размер шкафа по данному направлению:
        let previousSize = this.mouseEvents.previousSize.getComponent(index);

        // Какой компонент координаты мыши брать:
        let mouseIndex = index;

        // При изменении глубины меняем по изменению Z:
        if (index == 2) {
            mouseIndex = 1;
        }

        // Координата на плоскости:
        let planeCoordinate = point.getComponent(mouseIndex);

        // Предыдущая координата на плоскости:
        let initialPlaneCoordinate = this.mouseEvents.resizeStartPoint.getComponent(mouseIndex);

        // Изменение координаты:
        let deltaCoordinate = planeCoordinate - initialPlaneCoordinate;

        // Размер шкафа: предыдущий размер + координата
        let size = previousSize + deltaCoordinate;

        this.cupboard.setSizeComponent(index, size);
    }
}

/**
 * Обработчик щелчка мыши для шкафа.
 */
export class CupboardMouseUpHandler extends CupboardHandler {
    handle(data:EventData) {
        this.mouseEvents.changingSize.set(0, 0, 0);
    }
}

/**
 * Обработчик нажатия мыши на плоскости дял шкафа.
 */
export class CupboardPlaneMouseDownHandler extends CupboardHandler {
    handle(data:MouseEventData) {
        this.mouseEvents.resizeStartPoint = data.getPlaneIntersection().point;
        this.mouseEvents.previousSize = this.cupboard.size.clone();
    }
}

/**
 * Обработчик нажатия мыши на стене.
 */
export class WallMouseDownHandler extends CupboardHandler {
    constructor(mouseEvents:CupboardListener, cupboard:Cupboard, protected index:number) {
        super(mouseEvents, cupboard);
    }

    handle(data:EventData) {
        this.mouseEvents.changingSize.setComponent(this.index, 1);
    }
}

/**
 * Обработчик событий мыши секции стены.
 */
export class SectionWallMouseHandler extends EventHandler {
    constructor(protected section:Section,
                protected sections:Sections,
                public eventType:EventTypeEnum) {
        super();
    }

    handle(data:EventData) {
        data.stop = true;

        let resizing = (this.eventType == EventTypeEnum.MouseDown);

        if (resizing && this.sections.oneResizing) {
            return;
        }

        this.sections.setSectionResizing(this.section, resizing);
    }
}

/**
 * Куда открывается дверь.
 */
export enum DoorDirection {
    Left,
    Right
}

/**
 * Открыта ли дверь?
 */
export enum DoorState{
    Closed,
    Opening,
    Open,
    Closing
}

/**
 * Обработчик нажатия мыши на двери.
 */
export class DoorMouseUpHandler extends EventHandler {
    constructor(protected door:DoorSection,
                protected doors:DoorSections,
                public eventType:EventTypeEnum) {
        super();
    }

    handle(data:EventData) {
        data.stop = true;
        switch (this.door.state) {
            case DoorState.Opening:
            case DoorState.Closing:
                return;

            case DoorState.Closed:
                this.open();
                break;

            case DoorState.Open:
                this.close();
                break;
        }
    }

    protected open() {
        this.door.state = DoorState.Opening;

        let direction:number,
            checkOpening:() => boolean,
            rotation = this.door.wood.rotation,
            halfPi = Math.PI * 0.47;

        switch (this.door.openType) {
            case DoorDirection.Left:
                direction = -1;
                checkOpening = () => (rotation.y >= -halfPi);
                break;

            case DoorDirection.Right:
                direction = 1;
                checkOpening = () => (rotation.y <= halfPi);
                break;
        }

        let speed = 0.05,
            interval = setInterval(() => {
                // Вращаем дверь:
                rotation.y += speed * direction;

                // Уменьшаем скорость открытия двери для плавности:
                speed -= 0.0003;

                // Дверь всё ещё открывается
                if (checkOpening()) {
                    return;
                }

                clearInterval(interval);
                this.door.state = DoorState.Open;
            }, 20);
    }

    private close() {
        this.door.state = DoorState.Closing;

        let direction:number,
            checkClosing:() => boolean,
            rotation = this.door.wood.rotation;

        switch (this.door.openType) {
            case DoorDirection.Left:
                direction = 1;
                checkClosing = () => (rotation.y <= 0);
                break;

            case DoorDirection.Right:
                direction = -1;
                checkClosing = () => (rotation.y >= 0);
                break;
        }

        let speed = 0.05,
            interval = setInterval(() => {
                // Вращаем дверь:
                rotation.y += speed * direction;

                // Уменьшаем скорость открытия двери для плавности:
                speed -= 0.0003;

                // Дверь всё ещё открывается
                if (checkClosing()) {
                    return;
                }

                // Очищаем интервал:
                clearInterval(interval);

                // Закрываем дверь:
                this.door.state = DoorState.Closed;
            }, 20);
    }
}

/**
 * Обрабочик нажатий клавиатуры у двери.
 */
export class DoorKeyUpHandler extends EventHandler {
    constructor(protected doors:DoorSections) {
        super();
    }

    handle(data:KeyBoardEventData):void {
        if (data.jquery.keyCode != 79) {
            return;
        }

        this.doors.toggle();
    }
}

/**
 * Обработчик движений мыши по плоскости для секции.
 */
export class SectionPlaneMouseMoveHandler extends EventHandler {
    constructor(protected section:Section,
                protected sections:Sections) {
        super();
    }

    handle(data:MouseEventData) {
        if (!this.section.resizing) return;

        let direction = this.sections.direction,
            previous:Section = this.sections.getPrevious(this.section),
            next:Section = this.sections.getNext(this.section),
            directionSize = this.sections.getDirectionSize(),
            halfDirectionSize = directionSize / 2,
            mouseCoordinate = data.getPlaneIntersection().point.getComponent(direction), // координата мыши
            minEdge = previous ? previous.getWallPositionComponent(direction) : -halfDirectionSize, // откуда считать размер
            maxCoordinate = next ? next.getWallPositionComponent(direction) : +halfDirectionSize, // максимум координаты мыши
            minCoordinate = minEdge, // минимум координаты мыши
            minSectionSize = this.sections.thickness + this.sections.minSize; // минимальный размер секции

        // Добавляем минимальный размер секции к ограничениям.
        maxCoordinate -= minSectionSize;
        minCoordinate += minSectionSize;

        // Ограничения не позволяют перемещать секцию.
        if (minCoordinate > maxCoordinate) return;

        // Ограничиваем координату мыши
        mouseCoordinate = Math.min(mouseCoordinate, maxCoordinate);
        mouseCoordinate = Math.max(mouseCoordinate, minCoordinate);

        // Устанавливаем размер секции
        let size = mouseCoordinate - minEdge,
            relativeSize = size / directionSize;

        this.sections.setRelativeSectionSizeComponent(this.section, relativeSize);
    }
}

/**
 * Обработчик клавиатуры для шкафа.
 */
export class CupboardKeyHandler extends CupboardHandler {
    protected rotateInterval:number;
    protected moveInterval:number;

    handle(data:KeyBoardEventData):void {
        data.type == EventTypeEnum.KeyDown
            ? this.down(data)
            : this.up(data);
    }

    protected up(data:KeyBoardEventData):void {
        switch (data.jquery.keyCode) {
            case KeyCodeEnum.LEFT:
            case KeyCodeEnum.RIGHT:
                this.stopRotate();
                break;

            case KeyCodeEnum.UP:
            case KeyCodeEnum.DOWN:
                this.stopMove();
                break;
        }
    }

    protected down(data:KeyBoardEventData):void {
        switch (data.jquery.keyCode) {
            case KeyCodeEnum.LEFT:
                this.startRotate(+1);
                break;

            case KeyCodeEnum.RIGHT:
                this.startRotate(-1);
                break;

            case KeyCodeEnum.UP:
                this.startMove(+1);
                break;

            case KeyCodeEnum.DOWN:
                this.startMove(-1);
                break;
        }
    }

    protected stopRotate() {
        clearInterval(this.rotateInterval);
    }

    protected startRotate(multiplier:number = 1) {
        this.stopRotate();
        this.rotateInterval = setInterval(() => this.cupboard.rotation.y += 0.1 * multiplier, 20);
    }

    private startMove(multiplier:number) {
        this.stopMove();
        this.moveInterval = setInterval(() => this.cupboard.position.z += multiplier * 9, 20);
    }

    private stopMove() {
        clearInterval(this.moveInterval);
    }
}