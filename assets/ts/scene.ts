import {
    Object3D,
    Vector3,
    Geometry,
    Scene as ThreeScene,
    DirectionalLight,
    AmbientLight,
    Mesh,
    BoxGeometry,
    MeshPhongMaterial,
    ImageUtils,
    RepeatWrapping,
    BufferGeometry,
    PlaneBufferGeometry,
    MeshBasicMaterial,
} from "three";

import {
    Coordinate,
    Resizable
} from "./common";

import {
    EventManager,
    ObjectListener
} from "./event";

import {
    WallSectionsListener,
    DoorsListener,
    CupboardListener
} from "./listeners";

import {
    DoorState,
    DoorDirection
} from "./handlers";

/**
 * Сцена.
 */
export class Scene extends ThreeScene {
    protected clickPlane:BigPlane;
    protected listeners:ObjectListener[];

    constructor() {
        super();
        this.clickPlane = new BigPlane();
        this.add(this.clickPlane);
    }

    // Заполнить сцену объектами
    fill(eventManager:EventManager) {
        let cupboard = new Cupboard();
        this.adds(cupboard, new Lights());
        this.setListeners(eventManager, cupboard);
    }

    /**
     * Установить слушателей.
     *
     * @param eventManager
     * @param cupboard
     */
    protected setListeners(eventManager:EventManager, cupboard:Cupboard) {
        // Слушатели дверей и стен:
        let walls = (new WallSectionsListener(eventManager)),
            doors = (new DoorsListener(eventManager));

        // Устанавливаем массив слушателей:
        this.listeners = [
            new CupboardListener(cupboard, eventManager),
            walls.setSections(cupboard.sections),
            doors.setSections(cupboard.doors),
        ].concat();

        // Через 5 секунд устанавливаем количество стен и дверей на случайное:
        setTimeout(() => {
            walls.setAmount(Math.floor(Math.random() * 3) + 3);
            doors.setAmount(Math.floor(Math.random() * 3) + 3);
        }, 5000);

        // Получаем секции полок:
        this.listeners.forEach((events:ObjectListener) => events.listen(true));
    }

    // Добавить все объекты
    adds(...objects:Object3D[]):ThreeScene {
        objects.forEach((object:Object3D) => {
            this.add(object);
        });
        return this;
    }

    // Получить плоскость для клика
    getClickPlane():BigPlane {
        return this.clickPlane;
    }
}

/**
 * Освещение на сцене.
 */
class Lights extends Object3D {
    constructor() {
        super();
        this.add(new MainLight());
        this.add(new AmbientLight(0x666688));
    }
}

/**
 * Основной свет.
 */
class MainLight extends DirectionalLight {

    constructor() {
        super(0xffffee, 1);

        this.position.set(200, 300, 500);
        this.target.position.set(0, 0, 0);

        let alpha = 0,
            radius = 300;

        setInterval(() => {
            let x = Math.sin(alpha) * radius,
                y = Math.cos(alpha) * radius;

            alpha += 0.03;

            this.intensity = (Math.cos(alpha) + 1) * 0.25 + 0.5;

            this.position.setX(x).setY(y);
        }, 20);
        this.setShadowSettings();
    }

    protected setShadowSettings() {
        let size = 500;

        this.castShadow = true;


        this.shadowCameraFar = 4000;
        this.shadowCameraNear = 1;

        this.shadowBias = 0.0001;

        this.shadowCameraLeft = -size;
        this.shadowCameraRight = size;
        this.shadowCameraTop = size;
        this.shadowCameraBottom = -size;

        this.shadowMapWidth = 2048;
        this.shadowMapHeight = 2048;
    }
}

/**
 * Кусок дерева для стен / полок.
 */
export class Wood extends Mesh {
    constructor(size:Vector3 = new Vector3(1, 1, 1), position:Vector3 = new Vector3()) {
        super(
            new WoodGeometry() as any as BufferGeometry,
            new WoodMaterial()
        );

        this.scale.copy(size);
        this.position.copy(position);

        this.castShadow = true;
        this.receiveShadow = true;
    }
}

/**
 * Геометрия куска дерева.
 */
class WoodGeometry extends BoxGeometry {
    constructor() {
        super(1, 1, 1);
    }
}

/**
 * Материал куска дерева.
 */
class WoodMaterial extends MeshPhongMaterial {
    protected static color = 0x7777ff;

    constructor() {
        super({
            map: ImageUtils.loadTexture('wood_1.jpg')
        });

        let index = 1;
        setInterval(() => {
            if (++index > 2) {
                index = 1;
            }
            let texture = ImageUtils.loadTexture(`wood_${index}.jpg`);
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;
            this.map = texture;
        }, 5000);

    }
}

/**
 * Секция.
 *
 * Секция - это блок, размер которого можно изменять.
 * Секция всегда существует в наборе секций.
 * Например, стены шкафа разбивают его на секции.
 * А полки разбивают каждую из секций шкафа на секции полок.
 */
export class Section extends Object3D implements Resizable {
    public wood:Wood = null;
    protected size:Vector3 = new Vector3();
    public resizing:boolean = false;

    constructor(protected thickness:number,
                public relativeSize:number,
                protected direction:Coordinate) {
        super();

        // Добавляем стенку секции
        this.add(this.wood = new Wood());
        this.wood.scale.setComponent(direction, thickness);
    }

    deleteWall() {
        this.remove(this.wood);
        this.wood = null;
    }

    /**
     * Установить ширину
     *
     * @param index
     * @param size
     * @returns {Section}
     */
    setSizeComponent(index:Coordinate, size:number) {
        this.size.setComponent(index, size);

        // Стены нет - выходим.
        if (!this.wood) {
            return;
        }

        if (index == this.direction) {
            this.wood.position.setComponent(this.direction, size / 2);
            return;
        }

        this.wood.scale.setComponent(index, size);
    }

    setSize(size:Vector3):Section {
        for (let i = 0; i < 3; i++) {
            this.setSizeComponent(i, size.getComponent(i));
        }
        return this;
    }

    getWallPositionComponent(index:number) {
        return this.position.getComponent(index) + this.size.getComponent(index) / 2;
    }

    setPositionComponent(index:number, position:number) {
        this.position.setComponent(index, position);
        return this;
    }
}

/**
 * Секция с дверью.
 */
export class DoorSection extends Section {
    public state:DoorState = DoorState.Closed;

    constructor(thickness:number, relativeSize:number, public openType:DoorDirection) {
        super(thickness, relativeSize, Coordinate.X);
        this.setSizeComponent(Coordinate.Z, thickness);

        let translateX:number = (openType == DoorDirection.Left ? 0.5 : -0.5);
        (this.wood.geometry as Geometry).translate(translateX, 0, 0);
    }

    setSizeComponent(index:Coordinate, size:number) {
        if (index == Coordinate.X) {
            size *= 0.97;
        }

        if (index == Coordinate.Z) {
            this.wood.position.setZ(size / 2 + this.thickness);
            size = this.thickness;
        }

        this.size.setComponent(index, size);
        this.wood.scale.setComponent(index, size);
    }


    setPositionComponent(index:number, position:number) {
        if (index == Coordinate.X) {
            let halfWidth = this.size.x / 2;
            position += (this.openType == DoorDirection.Left ? -halfWidth : halfWidth);
        }
        super.setPositionComponent(index, position);
        return this;
    }
}

/**
 * Секция со стеной.
 */
class WallSection extends Section {
    public shelves:ShelfSections;

    constructor(thickness:number, relativeSize:number) {
        super(thickness, relativeSize, Coordinate.X);
    }

    setShelves(shelves:ShelfSections) {
        this.add(this.shelves = shelves);
        return this;
    }


    setSizeComponent(index:Coordinate, size:number):void {
        super.setSizeComponent(index, size);
        this.shelves.setSizeComponent(index, size);
    }
}

/**
 * Коллекция секций.
 *
 * @see Section
 */
export class Sections extends Object3D implements Resizable {
    protected sections:Section[] = [];
    public oneResizing:boolean = false;

    constructor(public direction:Coordinate,
                protected size:Vector3,
                public thickness:number,
                protected amount = 3,
                public minSize = 20,
                protected deleteLastWood = true) {
        super();

        // Устанавливаем изначальное количество секций:
        this.setAmount(amount);
    }

    getAll() {
        return this.sections;
    }

    setAmount(amount:number) {
        this.amount = amount;

        // Удаляем существующие секции:
        this.clear();

        // Размер всех секций:
        let sectionsSize:number = this.getDirectionSize(),
        // Размер одной секции:
            size:number = sectionsSize / amount,
        // Относительный размер секции:
            relativeSize:number = size / sectionsSize;

        for (let i = 0; i < amount; i++) {
            // Создаём секцию с заданным относительным размером:
            let section = this.createSection(relativeSize);

            // Добавляем сецию в массив секций и в объект:
            this.sections.push(section);
            this.add(section);
        }

        // Удаляем стенку / полку у последней секции
        if (this.deleteLastWood) {
            this.sections[amount - 1].deleteWall();
        }

        this.updateSectionsGeometry();
    }

    /**
     * Создать секцию
     *
     * @param relativeSize
     * @returns {Section}
     */
    protected createSection(relativeSize:number) {
        return new Section(this.thickness, relativeSize, this.direction);
    }

    /**
     * Установить, что мы перемещаем секцию.
     *
     * @param section
     * @param resizing
     * @returns {Sections}
     */
    setSectionResizing(section:Section, resizing:boolean = true) {
        section.resizing = resizing;
        this.oneResizing = resizing;
        return this;
    }

    /**
     * Установить размер секции.
     *
     * @param section
     * @param size
     * @param checkNext
     * @returns {Sections}
     */
    setRelativeSectionSizeComponent(section:Section, size:number, checkNext:boolean = true):void {
        // Изменение относительного размера:
        let deltaSize = size - section.relativeSize;

        // Устанавливаем относительный размер:
        section.relativeSize = size;

        // Если не надо проверять следующий элемент, выходим:
        if (!checkNext) {
            this.updateSectionsGeometry();
            return;
        }


        let next = this.getNext(section);
        // Следующего нет:
        if (!next) {
            this.updateSectionsGeometry();
            return;
        }

        // Устанавливаем размер следующему элементу:
        this.setRelativeSectionSizeComponent(next, next.relativeSize - deltaSize, false);

    }

    /**
     * Установить размер.
     *
     * @param index
     * @param size
     */
    setSizeComponent(index:Coordinate, size:number) {
        this.size.setComponent(index, size);
        this.updateSectionsGeometry();
    }

    /**
     * Получить размер по направлению секции (горизонтальная - ширина, вертикальная - высота)
     *
     * @returns {number}
     */
    getDirectionSize() {
        return this.size.getComponent(this.direction);
    }

    /**
     * Обновить положения и размеры секций по их относительным размерам.
     *
     * @returns {Sections}
     */
    updateSectionsGeometry() {
        // Положение секции
        let position = -this.getDirectionSize() / 2;

        for (let section of this.sections) {
            // Размер секции по направлению
            let directionSize:number = this.getDirectionSize() * section.relativeSize;

            // Отодвигаем координату центра секции на половину размера.
            position += directionSize / 2;

            // Размер секции
            let sectionSize = this.size.clone();

            // Устанавливаем размер секции по направлению
            sectionSize.setComponent(this.direction, directionSize);

            // Устанавливаем размер и положение секции
            section
                .setSize(sectionSize)
                .setPositionComponent(this.direction, position);

            position += directionSize / 2;
        }
        return this;
    }

    /**
     * Очистить секции
     *
     * @returns {Sections}
     */
    protected clear() {
        // Удаляем каждую секцию из объекта:
        this.sections.forEach((section:Section) => this.remove(section));

        // Очищаем массив с секциями:
        this.sections = [];

        return this;
    }

    /**
     * Получить предыдущую секцию.
     *
     * @param section
     * @returns {Section}
     */
    getPrevious(section:Section) {
        return this.getNear(section, -1);
    }

    /**
     * Получить следующую секцию.
     *
     * @param section
     * @returns {Section}
     */
    getNext(section:Section) {
        return this.getNear(section, +1);
    }

    /**
     * Получить секцию рядом с указанной
     *
     * @param section
     * @param deltaIndex
     * @returns {Section}
     */
    protected getNear(section:Section, deltaIndex:number):Section {
        let index:number = this.sections.indexOf(section);
        if (index == -1) {
            return null;
        }
        let nearIndex:number = index + deltaIndex;
        return this.sections[nearIndex] || null;
    }
}

/**
 * Секции с полками.
 */
export class ShelfSections extends Sections {
    constructor(size:Vector3,
                thickness:number,
                amount:number,
                minSize:number = 20) {
        super(
            Coordinate.Y,
            size,
            thickness,
            amount,
            minSize
        );
    }
}

/**
 * Секции с дверьми.
 */
export class DoorSections extends Sections {
    constructor(size:Vector3, thickness:number, amount:number = 3, minSize:number = 20) {
        super(Coordinate.X, size, thickness, amount, minSize, false);
    }

    protected createSection(relativeSize:number):Section {
        return new DoorSection(this.thickness, relativeSize, Math.round(Math.random()));
    }


    toggle() {
        this.visible = !this.visible;
    }
}

/**
 * Секции-стены
 */
export class WallSections extends Sections {
    constructor(boundSize:Vector3,
                thickness:number,
                amount:number,
                minWidth:number = 20) {
        super(
            Coordinate.X,
            boundSize,
            thickness,
            amount,
            minWidth
        );
    }

    /** @inheritDoc */
    protected createSection(relativeSize:number) {
        // Создаём секцию и в ней задаём секции с полками:
        let section = new WallSection(this.thickness, relativeSize),
            shelfWidth = relativeSize * this.getDirectionSize(),
            shelves = this.createShelves(shelfWidth);

        section.setShelves(shelves);
        return section;
    }

    /**
     * Создать секцию с полками.
     *
     * @param width
     * @returns {ShelfSections}
     */
    protected createShelves(width:number) {
        // Размер секции полок:
        return new ShelfSections(
            this.size.clone().setX(width),
            this.thickness,
            Math.floor(Math.random() * 3) + 3
        );
    }

    getShelfSections():ShelfSections[] {
        return this.getAll().map((section:WallSection) => section.shelves);
    }
}

/**
 * Шкаф.
 */
export class Cupboard extends Object3D implements Resizable {
    public walls:Walls;
    public sections:WallSections;
    public doors:DoorSections;

    /**
     * Объекты, которые будут изменять свой размер вместе со шкафом:
     * @type {Array}
     */
    protected resizables:Resizable[] = [];

    constructor(public size:Vector3 = new Vector3(300, 250, 60),
                protected thickness:number = 3,
                protected minSize:Vector3 = new Vector3(100, 100, 30),
                protected maxSize:Vector3 = new Vector3(500, 400, 100)) {
        super();

        // Стены шкафа:
        this.walls = new Walls(size, thickness);

        // Расчет случайного количества секций и дверей:
        let rand = (from:number, to:number) => Math.floor(Math.random() * (to - from) + from);

        // Секции с полками:
        this.sections = new WallSections(size, thickness, rand(3, 6));

        // Двери:
        this.doors = new DoorSections(size, thickness, rand(3, 6));

        // Добавляем объекты, которые будут изменять свой размер:
        this.resizables.push(this.walls, this.sections, this.doors);

        this.add(this.walls);
        this.add(this.sections);
        this.add(this.doors);
    }

    /**
     * Установить размер.
     *
     * @param index
     * @param size
     * @returns {Cupboard}
     */
    setSizeComponent(index:Coordinate, size:number) {
        size = this.limitSize(index, size);
        this.size.setComponent(index, size);
        for (let resizable of this.resizables) {
            resizable.setSizeComponent(index, size);
        }
    }

    protected limitSize(index:Coordinate, size:number):number {
        size = Math.max(size, this.minSize.getComponent(index));
        size = Math.min(size, this.maxSize.getComponent(index));
        return size;
    }
}

/**
 * Плоскость, по которой будут двигаться стены
 */
export class BigPlane extends Mesh {
    constructor() {
        super(
            new PlaneBufferGeometry(2000, 2000, 8, 8),
            new MeshBasicMaterial({
                // color: 0xff0000
                visible: false
            })
        );


    }
}

/**
 * Основные стены шкафа.
 */
class Walls extends Object3D implements Resizable {
    public left:Wood;
    public right:Wood;
    public top:Wood;
    public bottom:Wood;
    public back:Wood;

    constructor(protected boundSize:Vector3, protected thickness:number) {
        super();

        this
            .createLeftRight(boundSize, thickness)
            .createTopBottom(boundSize, thickness)
            .createBack(boundSize, thickness);
    }

    // Левая и правая стена
    protected createLeftRight(boundSize:Vector3, thickness:number):Walls {
        let size = boundSize.clone().setX(thickness);
        let position = new Vector3((thickness - boundSize.x) / 2, 0, 0);
        this.left = new Wood(size, position);

        position.x *= -1;
        this.right = new Wood(size, position);

        this.add(this.left);
        this.add(this.right);
        return this;
    }

    // Верхняя и нижняя стена
    protected createTopBottom(boundSize:Vector3, thickness:number):Walls {
        let size = boundSize.clone().setY(thickness).setX(boundSize.x - thickness * 2);
        let position = new Vector3(0, (boundSize.y - thickness) / 2, 0);
        this.top = new Wood(size, position);
        position.y *= -1;
        this.bottom = new Wood(size, position);
        this.add(this.top);
        this.add(this.bottom);
        return this;
    }

    // Задняя стена
    protected createBack(boundSize:Vector3, thickness:number):Walls {
        let size = boundSize.clone().setZ(thickness);
        let position = new Vector3(0, 0, -boundSize.z / 2);
        this.back = new Wood(size, position);
        this.add(this.back);
        return this;
    }

    setSizeComponent(index:Coordinate, size:number) {
        this.boundSize.setComponent(index, size);

        let half:number = (size + this.thickness) * 0.5,
            resizables:Wood[] = [];

        switch (index) {
            case Coordinate.X:
                this.right.position.x = half;
                this.left.position.x = -half;
                resizables = [
                    this.top,
                    this.bottom,
                    this.back
                ];
                break;

            case Coordinate.Y:
                this.top.position.y = half;
                this.bottom.position.y = -half;
                resizables = [
                    this.left,
                    this.right,
                    this.back
                ];
                break;

            case Coordinate.Z:
                this.back.position.z = -half;
                resizables = [
                    this.left,
                    this.right,
                    this.top,
                    this.bottom
                ];
                break;
        }

        resizables.forEach((wall:Wood) => wall.scale.setComponent(index, size));

        return this;
    }
}