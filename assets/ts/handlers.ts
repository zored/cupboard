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
    DoorSections,
    Wood, OpenDoorSection
} from "./scene";

import {
    Vector3
} from "three";

import {
    CupboardListener
} from "./listeners";

import {
    Coordinate
} from "./common";

/**
 * Обработчик событий для шкафа.
 */
abstract class CupboardHandler extends EventHandler {
    constructor(protected listener:CupboardListener,
                protected cupboard:Cupboard) {
        super();
    }
}

/**
 * Обработчик движения мыши по плоскости для шкафа.
 */
export class CupboardPlaneMouseMoveHandler extends CupboardHandler {
    handle(data:MouseEventData) {
        // Получить точку пересечения с плоскостью:
        let point = data.getPlaneIntersection().point;

        // Для каждой координаты измнить размер.
        for (let index = 0; index < 3; index++) {
            this.changeSizeComponent(index, point);
        }
    }

    /**
     * Изменить размер.
     *
     * @param index
     * @param point
     */
    protected changeSizeComponent(index:Coordinate, point:Vector3) {
        // Если у слушателя не установлено, что данный размер изменяется - выходим.
        if (!this.listener.changingSize.getComponent(index)) {
            return;
        }

        // Получаем предыдущий размер шкафа по оси:
        let previousAxisSize = this.listener.previousSize.getComponent(index);

        // Какой компонент координаты мыши брать:
        let mouseIndex = index;

        // Если меняем глубину - значение берется по оси Y:
        if (index == Coordinate.Z) {
            mouseIndex = Coordinate.Y;
        }

        // Координата по оси на плоскости:
        let planeAxisCoordinate = point.getComponent(mouseIndex);

        // Предыдущая координата по оси на плоскости:
        let initialPlaneCoordinate = this.listener.resizeStartPoint.getComponent(mouseIndex);

        // Изменение координаты по оси:
        let deltaCoordinate = planeAxisCoordinate - initialPlaneCoordinate;

        // Размер по оси для шкафа: предыдущий размер + координата
        let size = previousAxisSize + deltaCoordinate;

        // Устанавливаем размер шкафа:
        this.cupboard.setSizeComponent(index, size);
    }
}

/**
 * Обработчик щелчка мыши для шкафа.
 */
export class CupboardMouseUpHandler extends CupboardHandler {
    handle(data:EventData) {
        this.listener.changingSize.set(0, 0, 0);
    }
}

/**
 * Обработчик нажатия мыши на плоскости дял шкафа.
 */
export class CupboardPlaneMouseDownHandler extends CupboardHandler {
    handle(data:MouseEventData) {
        this.listener.resizeStartPoint = data.getPlaneIntersection().point;
        this.listener.previousSize = this.cupboard.size.clone();
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
        this.listener.changingSize.setComponent(this.index, 1);
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
 * Обработчик наведения мыши / снятия наведения
 */
export class WoodMouseToggleHandler extends EventHandler {
    constructor(public wood:Wood) {
        super();
    }

    /** @inheritDoc */
    handle(data:EventData):void {
        // Навели ли мы указатель или увели:
        let enter = (data.type == EventTypeEnum.MouseEnter);

        console.log(enter ? 'entering' : 'leaving');

        // Наводим мышь на часть секции:
        this.wood.setHover(enter);
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
export class OpenDoorMouseUpHandler extends EventHandler {
    constructor(protected door:OpenDoorSection,
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
 * Обработчик движений мыши по плоскости для двери.
 */
export class SlideDoorPlaneMouseMoveHandler extends EventHandler {
    constructor(protected door:Section,
                protected doors:Sections) {
        super();
    }

    handle(data:MouseEventData) {
        if (!this.door.resizing) return;

        // Координата X для двери
        let x = data.getPlaneIntersection().point.x;

        // Задаём ограничения для размера:
        let max = this.getMax();
        x = Math.min(x, max);

        let min = this.getMin();
        x = Math.max(x, min);

        // Устанавливаем координату:
        this.door.position.setX(x);
    }

    protected getMax() {
        let door = this.getNextAfterNext();
        if (!door) {
            return this.doors.getDirectionSize() / 2;
        }
        return door.position.x - door.wood.scale.x;
    }

    protected getMin() {
        let door = this.getPreviousBeforePrevious();
        if (!door) {
            return -this.doors.getDirectionSize() / 2;
        }
        return door.position.x + door.wood.scale.x;
    }

    protected getNextAfterNext() {
        let next = this.doors.getNext(this.door);
        if (!next) {
            return null;
        }
        return this.doors.getNext(next);
    }

    protected getPreviousBeforePrevious() {
        let previous = this.doors.getPrevious(this.door);
        if (!previous) {
            return null;
        }
        return this.doors.getPrevious(previous);

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