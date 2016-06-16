import {
    Object3D,
    Vector3,
    Geometry,
    Scene as ThreeScene,
    DirectionalLight,
    AmbientLight,
    Mesh,
    Color,
    BoxGeometry,
    MeshPhongMaterial,
    ImageUtils,
    RepeatWrapping,
    BufferGeometry,
    PlaneBufferGeometry,
    MeshBasicMaterial,
    TextureLoader
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
        this.add(new AmbientLight(0x888899));
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

        // this.startMoveAround(0, 300);
        this.setShadowSettings();
    }

    /**
     * Начать двигаться по кругу.
     *
     * @param alpha
     * @param radius
     */
    private startMoveAround(alpha:number, radius:number) {
        setInterval(() => {
            let x = Math.sin(alpha) * radius,
                y = Math.cos(alpha) * radius;

            alpha += 0.03;

            this.intensity = (Math.cos(alpha) + 1) * 0.25 + 0.5;

            this.position.setX(x).setY(y);
        }, 20);
    }

    protected setShadowSettings() {

        // Отбрасывать тень%
        this.castShadow = true;

        // Размер для камеры:
        let size = 500,
        // Камера света
            camera = this.shadow.camera as any;

        // Настройки камеры:
        camera.far = 4000;
        camera.near = 1;
        camera.left = -size;
        camera.right = size;
        camera.top = size;
        camera.bottom = -size;

        // Сглаживание тени:
        this.shadow.bias = 0.0001;

        // Размеры карты тени:
        this.shadow.mapSize.set(1024, 1024);
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

    /**
     * Навели указатель мыши / увели его.
     *
     * @param enter
     * @returns {Wood}
     */
    setHover(enter:boolean) {
        (this.material as WoodMaterial).setHover(enter);
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
        super();

        // Устанавливаем текстуру:
        this.map = WoodMaterial.getTexture();

        // this.startChangingMaterial();
    }

    /**
     * Получить текстуру дерева.
     *
     * @returns {Texture}
     */
    protected static getTexture() {
        return (new TextureLoader()).load('wood_1.jpg');
    }

    /**
     * Подсветить.
     * @param enter
     * @returns {WoodMaterial}
     */
    setHover(enter:boolean) {
        if (enter) {
            this.color = new Color(0xff0000);
            this.map = null;
            return;
        }
        this.color = new Color(0xffffff);
        this.map = WoodMaterial.getTexture();
        return this;
    }

    /**
     * Начать циклично изменять материал.
     */
    protected startChangingMaterial() {
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

    hideWall() {
        this.remove(this.wood);
        this.wood = null;
    }

    /**
     * Установить размер секции.
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
            let coordinate = size / 2;
            this.wood.position.setComponent(this.direction, coordinate);
            return;
        }

        this.wood.scale.setComponent(index, size - this.thickness);
    }

    /**
     * Установить размер секции.
     *
     * @param size
     * @returns {Section}
     */
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
 * Секция с открывающейся дверью.
 */
export class OpenDoorSection extends Section {
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
 * Секция с  дверью.
 */
export class SlideDoorSection extends Section {
    constructor(thickness:number, relativeSize:number, public openType:DoorDirection) {
        super(thickness, relativeSize, Coordinate.X);
        this.setSizeComponent(Coordinate.Z, thickness);
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

    /**
     * Получить все секции в виде массива.
     *
     * @returns {Section[]}
     */
    getAll():Section[] {
        return this.sections;
    }

    /**
     * Установить количество секций.
     *
     * @param amount
     */
    setAmount(amount:number) {
        this.amount = amount;

        // Удаляем существующие секции:
        this.clear();

        // Размер всех секций:
        let sectionsSize:number = this.getDirectionSize();

        // Размер одной секции:
        let size:number = sectionsSize / amount;

        // Относительный размер секции:
        let relativeSize:number = size / sectionsSize;

        // По количеству секций:
        for (let i = 0; i < amount; i++) {
            // Создаём секцию с заданным относительным размером:
            let section = this.createSection(relativeSize);

            // Добавляем сецию в массив секций и в объект:
            this.sections.push(section);
            this.add(section);
        }

        // Скрываем стенку / полку у последней секции, если это нужно
        if (this.deleteLastWood) {
            this.sections[amount - 1].hideWall();
        }

        // Обновляем геометрию секций:
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
        // Размер секций по направлению:
        let allDirectionSize = this.getDirectionSize() - this.thickness * 2;

        // Положение секции:
        let position = -allDirectionSize / 2;

        for (let section of this.sections) {
            // Размер секции по направлению
            let directionSize:number = allDirectionSize * section.relativeSize;

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
    /**
     * Пcследняя дверь была спереди.
     * @type {boolean}
     */
    protected static lastForward = false;

    constructor(size:Vector3, thickness:number, amount:number = 3, minSize:number = 20) {
        super(Coordinate.X, size, thickness, amount, minSize, false);
    }

    protected createSection(relativeSize:number):Section {
        let door = new SlideDoorSection(this.thickness, relativeSize, Math.round(Math.random()));
        if (DoorSections.lastForward) {
            door.position.setZ(door.position.z - this.thickness);
        }
        DoorSections.lastForward = !DoorSections.lastForward;
        return door;
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
                protected shelvesAmount:number,
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
            this.shelvesAmount
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
    /**
     * Стены.
     */
    public walls:Walls;

    /**
     * Секции с полками.
     */
    public sections:WallSections;

    /**
     * Двери.
     */
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

        // Секции с полками:
        this.sections = new WallSections(size, thickness, this.getRandomSectionAmount(), this.getRandomSectionAmount());

        // Двери:
        this.doors = new DoorSections(size, thickness, this.getRandomSectionAmount());

        // Добавляем объекты, которые будут изменять свой размер:
        this.resizables.push(
            this.walls,
            this.sections,
            this.doors
        );

        this.add(this.walls);
        this.add(this.sections);
        this.add(this.doors);
    }

    /**
     * Получить случайное число секций .
     *
     * @returns {number}
     */
    protected getRandomSectionAmount() {
        let rand = (from:number, to:number) => Math.floor(Math.random() * (to - from) + from);
        return rand(3, 6);
    }

    /**
     * Установить размер.
     *
     * @param index
     * @param size
     * @returns {Cupboard}
     */
    setSizeComponent(index:Coordinate, size:number) {
        // Задаем размеру ограничения:
        size = this.limitSize(index, size);

        // Устанавливаем компонент размера:
        this.size.setComponent(index, size);

        // Для каждого resizables задаем размер:
        for (let resizable of this.resizables) {
            resizable.setSizeComponent(index, size);
        }
    }

    /**
     * Ограничить размер.
     *
     * @param index
     * @param size
     * @returns {number}
     */
    protected limitSize(index:Coordinate, size:number):number {
        // Размер должен быть не больше максимального:
        size = Math.max(size, this.minSize.getComponent(index));

        // И не меньше минимального:
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
    /**
     * Левая.
     */
    public left:Wood;

    /**
     * Правая.
     */
    public right:Wood;

    /**
     * Верхняя.
     */
    public top:Wood;

    /**
     * Нижняя.
     */
    public bottom:Wood;

    /**
     * Задняя.
     */
    public back:Wood;

    constructor(protected size:Vector3, protected thickness:number) {
        super();

        // Создаём стенки:
        this
            .createLeftRight()
            .createTopBottom()
            .createBack();
    }

    /**
     * Создать левую и правую стенки.
     *
     * @returns {Walls}
     */
    protected createLeftRight():Walls {
        // Берем рамзер шкафа и задаем ширину, равную толщине стенки:
        let size = this.size.clone().setX(this.thickness);

        // По оси X сдвигаем влево на полшкафа и полтолщины:
        let x = this.getHalf(this.size.x);

        // Задаем левую и правую стенки:
        this.add(this.left = new Wood(size, new Vector3(-x, 0, 0)));
        this.add(this.right = new Wood(size, new Vector3(x, 0, 0)));
        return this;
    }

    /**
     * Создать верхнюю и нижнюю стены.
     *
     * @returns {Walls}
     */
    protected createTopBottom():Walls {
        // Размер равен размеру шкафа с высотой, равной толщие и щириной, меньшей на две толщины.
        let size = this.size
            .clone()
            .setY(this.thickness)
            .setX(this.size.x - this.thickness * 2);

        // Координата стенки по оси Y.
        var y = this.getHalf(this.size.y);

        // Задаем вернхюю и нижнюю стенки:
        this.add(this.bottom = new Wood(size, new Vector3(0, -y, 0)));
        this.add(this.top = new Wood(size, new Vector3(0, y, 0)));
        return this;
    }

    /**
     * Создать заднюю стенку.
     *
     * @returns {Walls}
     */
    protected createBack():Walls {
        // Размер равен размеру шкафа с глубиной, равной толщине:
        let size = this.size
            .clone()
            .setZ(this.thickness);

        // Задаём координату Z:
        var z = this.getHalf(this.size.z);

        // Добавить заднюю стенку
        this.add(this.back = new Wood(size, new Vector3(0, 0, -z)));
        return this;
    }

    protected getHalf(size:number):number{
        return (size - this.thickness) / 2;
    }

    /** @inheritDoc */
    setSizeComponent(index:Coordinate, size:number) {
        // Установить размер шкафа по оси.
        this.size.setComponent(index, size);

        // Половина размера:
        let half:number = this.getHalf(size);

        // Объекты, чей размер мы изменим.
        let resizables:Wood[] = [];

        // Размер для ресайза:
        let scaleSize = size;

        switch (index) {
            case Coordinate.X:
                this.right.position.x = half;
                this.left.position.x = -half;
                resizables = [
                    this.top,
                    this.bottom,
                    this.back
                ];
                scaleSize -= this.thickness * 2;
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

        // Функция изменения размера:
        let scale = (wall:Wood) => wall.scale.setComponent(index, scaleSize);

        resizables.forEach(scale);

        return this;
    }
}