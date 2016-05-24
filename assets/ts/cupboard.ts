import * as THREE from "three";
import V2 = THREE.Vector2;
import V3 = THREE.Vector3;
import Object3D = THREE.Object3D;
import Vector2 = THREE.Vector2;
import Mesh = THREE.Mesh;
import Intersection = THREE.Intersection;
import BufferGeometry = THREE.BufferGeometry;

// Мир шкафа
export class World {
    protected renderer:Renderer;
    protected scene:Scene;
    protected camera:Camera;
    protected active:boolean = true;
    protected mouseEventManager:MouseEventManager;

    constructor(protected canvas:Canvas) {
        this.scene = new Scene();
        this.renderer = new Renderer(canvas);
        this.camera = new Camera(canvas);
        this.mouseEventManager = new MouseEventManager(this.canvas, this.scene, this.camera);

        // Слушаем действия мыши
        this.mouseEventManager.startListen();

        // Заполняем сцену объектами
        this.scene.fill(this.mouseEventManager);
    }

    // Каждый фрейм запускать рендер
    protected render():World {
        if (!this.active) return this;

        requestAnimationFrame(() => this.render());
        this.renderer.render(this.scene, this.camera);
        return this;
    }

    // Запустить мир
    start():World {
        this.active = true;
        return this.render();
    }

    // Остановить мир
    pause():World {
        this.active = false;
        return this;
    }
}

class MouseRaycaster extends THREE.Raycaster {
    constructor(protected camera:Camera) {
        super();
    }

    setPosition(position:THREE.Vector2):MouseRaycaster {
        this.setFromCamera(position, this.camera);
        return this;
    }
}

// Типы событий мыши
enum MouseEventType {
    Down,
    Up,
    Move
}

interface MouseEventsContainer {
    [type:number]:MouseCallback[]
}

interface ObjectCallbacks {
    callbacks:MouseCallback[],
    object:Object3D
}

interface MouseObjectEventsContainer {
    [type:number]:ObjectCallbacks[]
}


type MouseCallback = (event:MyMouseEvent) => void;

class MouseEventManager {
    protected objects:Object3D[] = [];
    protected raycaster:MouseRaycaster;
    protected plane:ClickPlane;
    protected objectsEvents:MouseObjectEventsContainer = {};
    protected planeEvents:MouseEventsContainer = {};

    constructor(protected canvas:Canvas, scene:Scene, protected camera:Camera) {
        this.raycaster = new MouseRaycaster(camera);
        this.plane = scene.getClickPlane();
    }

    // Устанавливаем слушателей на события мыши
    startListen() {
        this.canvas
            .getJQuery()
            .mousedown((event:JQueryMouseEventObject) => this.trigger(event, MouseEventType.Down))
            .mousemove((event:JQueryMouseEventObject) => this.trigger(event, MouseEventType.Move))
            .mouseup((event:JQueryMouseEventObject) => this.trigger(event, MouseEventType.Up));
        return this;
    }

    // Получить первое пересечение луча с объектом:
    protected intersect(object:Object3D):Intersection {
        return this.raycaster.intersectObject(object)[0];
    }

    // Событие при перемещении мыши
    protected trigger(jqEvent:JQueryMouseEventObject, type:MouseEventType) {
        // Получаем положение мыши
        var mouse = new V2(jqEvent.offsetX, jqEvent.offsetY);

        // Получаем относительное положение мыши на канвасе
        let position = this.canvas.getRelativePoint(mouse);

        // Установить положение точки в испускателе лучей
        this.raycaster.setPosition(position);

        // Событие
        let event = new MyMouseEvent();

        // Установить пересечение с плоскостью
        event.setPlaneIntersection(this.intersect(this.plane));

        // Вызываем события
        this.getPlaneCallbacks(type).forEach((callback:MouseCallback) => callback(event));

        // Для каждого объекта на сцене выполняем проверку
        this.objects.forEach((object:Object3D) => {
            // Получаем пересечение луча с объектом
            let intersection = this.intersect(object);

            // Пересечения нет
            if (!intersection || !intersection.point) {
                return;
            }

            // Устанавливаем пересечение для события
            event.setIntersection(intersection);

            // Отправляем событие объекту
            this.getObjectCallbacks(type, object).forEach((callback:MouseCallback) => callback(event));
        });
    }

    // Получить колбэки
    getObjectCallbacks(type:MouseEventType, object:Object3D):MouseCallback[] {
        if (!this.objectsEvents[type]) return [];

        let objectCallbacks = this.objectsEvents[type].filter(
            (objectCallbacks:ObjectCallbacks) => (objectCallbacks.object == object)
        )[0];

        return objectCallbacks ? objectCallbacks.callbacks : [];
    }

    getPlaneCallbacks(type:MouseEventType):MouseCallback[] {
        return this.planeEvents[type] || [];
    }

    // Добавить событие на плоскость
    onPlane(type:MouseEventType, callback:MouseCallback):MouseEventManager {
        if (!this.planeEvents[type]) this.planeEvents[type] = [];
        this.planeEvents[type].push(callback);
        return this;
    }

    // Добавить событие на объект
    onObject(type:MouseEventType, object:Object3D, callback:MouseCallback):MouseEventManager {
        if (!this.objectsEvents[type]) this.objectsEvents[type] = [];

        let objectCallbacks = this.objectsEvents[type].filter(
            (objectCallbacks:ObjectCallbacks) => (objectCallbacks.object == object)
        )[0];

        var hasListener = this.objects.some((object_:Object3D) => object_ == object);

        if (!hasListener) this.objects.push(object);

        if (!objectCallbacks) {
            this.objectsEvents[type].push({
                object: object,
                callbacks: [callback]
            });
            return this;
        }

        objectCallbacks.callbacks.push(callback);
        return this;
    }
}

// Холст
export class Canvas {
    protected size:V2;

    constructor(width:number, height:number, protected $canvas:JQuery) {
        this.size = new V2(width, height);
    }

    // Получить HTML-элемент холста
    getHTMLElement():HTMLCanvasElement {
        return <HTMLCanvasElement> this.$canvas.get(0);
    }

    // Получить размер холста
    getSize():V2 {
        return this.size;
    }

    // Получить отношение ширины к высоте
    getAspect():number {
        return this.size.width / this.size.height;
    }

    // Получить $canvas
    getJQuery():JQuery {
        return this.$canvas;
    }

    // Получить положение точки на холсте в относительных координатах
    getRelativePoint(position:Vector2):Vector2 {
        var point = position.clone();

        // Преобразуем координаты в относительные
        point.x = (point.x / this.size.x) * 2 - 1;
        point.y = (point.y / this.size.y) * 2 - 1;
        point.y *= -1;

        return point;
    }
}

// Камера
class Camera extends THREE.PerspectiveCamera {
    constructor(canvas:Canvas) {
        super(75, canvas.getAspect(), 0.1, 1000);

        // Сдвигаемся
        this.position.set(40, 0, 260);

        // Смотрим в начало координат
        this.lookAt(new V3());
    }
}

// Рендерщик. Выводит изображение сцены с камерой на холст.
class Renderer extends THREE.WebGLRenderer {
    constructor(canvas:Canvas) {
        super({
            alpha: true,
            canvas: canvas.getHTMLElement()
        });

        // Установить размер
        this.setSize(
            canvas.getSize().width,
            canvas.getSize().height
        );

        // Задать цвет очистки
        this.setClearColor(0xffffff, 0);
    }
}

// Сцена
class Scene extends THREE.Scene {
    protected clickPlane:ClickPlane;

    constructor() {
        super();
        this.clickPlane = new ClickPlane();
        this.add(this.clickPlane);
    }

    // Заполнить сцену объектами
    fill(mouseEventManager:MouseEventManager) {
        this.adds(new Cupboard(mouseEventManager), new Light());
    }

    // Добавить все объекты
    adds(...objects:Object3D[]):THREE.Scene {
        objects.forEach((object:Object3D) => {
            this.add(object);
        });
        return this;
    }

    // Получить плоскость для клика
    getClickPlane():ClickPlane {
        return this.clickPlane;
    }
}

// Освещение
class Light extends THREE.PointLight {
    constructor() {
        super(THREE.ColorKeywords.white);
        this.position.add(new V3(200, 300, 500));
        this.intensity = 0.7;
    }
}

// Стена
class Wall extends THREE.Mesh {
    constructor(size:V3 = new V3(1, 1, 1), position:V3 = new V3()) {
        super(
            new WallGeometry() as any as THREE.BufferGeometry,
            new WallMaterial()
        );

        this.scale.copy(size);
        this.position.copy(position);
    }
}

// Событие при нажатии мыши>
class MyMouseEvent {
    protected intersection:Intersection;
    protected planeIntersection:Intersection;

    // Установить пересечение мыши с плоскостью
    setPlaneIntersection(planeIntersection:Intersection):MyMouseEvent {
        this.planeIntersection = planeIntersection;
        return this;
    }

    // Получить пересечение мыши с плоскостью
    getPlaneIntersection():Intersection {
        return this.planeIntersection;
    }

    setIntersection(intersection:Intersection):MyMouseEvent {
        this.intersection = intersection;
        return this;
    }

    getIntersection():Intersection {
        return this.intersection;
    }
}

// Геометрия стены
class WallGeometry extends THREE.BoxGeometry {
    constructor() {
        super(1, 1, 1);
    }
}

// Материал стены
class WallMaterial extends THREE.MeshLambertMaterial {
    constructor() {
        super({
            color: 0xff0000
        });
    }
}

// Плоскость, по которой будут двигаться стены
class ClickPlane extends THREE.Mesh {
    constructor() {
        super(
            new THREE.PlaneBufferGeometry(2000, 2000, 8, 8),
            new THREE.MeshBasicMaterial({
                // color: 0xff0000
                visible: false
            })
        );
    }
}

class Section extends Object3D {
    public wall:Wall = null;
    protected size:V3 = new V3();
    public resizing:boolean = false;

    constructor(protected thickness:number, public relativeSize:number, protected direction:SectionsDirection) {
        super();

        // Добавляем стенку секции
        this.add(this.wall = new Wall());
        this.wall.scale.setComponent(direction, thickness);
    }

    /**
     * Установить ширину
     *
     * @param index
     * @param size
     * @returns {Section}
     */
    setSizeComponent(index:number, size:number):Section {
        this.size.setComponent(index, size);
        if (!this.wall) return;

        if (index == 0) {
            this.wall.position.setX(size / 2);
            return this;
        }

        this.wall.scale.setComponent(index, size);
        return this;
    }

    setSize(size:V3):Section {
        for (var i = 0; i < 3; i++) {
            this.setSizeComponent(i, size.getComponent(i));
        }
        return this;
    }

    getWallComponent(index:number) {
        return this.position.getComponent(index) + this.size.getComponent(index) / 2;
    }

    getSizeComponent(index:number) {
        return this.size.getComponent(index);
    }

    setPositionComponent(index:number, position:number) {
        this.position.setComponent(index, position);
        return this;
    }
}

enum SectionsDirection{
    Horizontal = 0,
    Vertical = 1
}

class SectionsEvents {
    protected sectionsEvents:SectionEvent[] = [];

    constructor(protected mouseEventManager:MouseEventManager, protected sections:Sections) {
        sections.getAll().forEach(this.getSectionEvent);
    }

    protected getSectionEvent = (section:Section) => {
        this.sectionsEvents.push(new SectionEvent(this.mouseEventManager, section, this.sections));
    }
}

class SectionEvent {
    constructor(
        mouseEventManager:MouseEventManager,
        section:Section,
        sections:Sections
    ){
        if (!section.wall) return;

        let previous:Section = sections.getPrevious(section),
            next:Section = sections.getNext(section);

        // Когда жмем на стенку секции
        mouseEventManager
            .onObject(
                MouseEventType.Down,
                section.wall,
                () => sections.setSectionResizing(section)
            )

            // Когда перестаем жать на стенку секции
            .onPlane(
                MouseEventType.Up,
                () => sections.setSectionResizing(section, false)
            )

            // Когда двигаем мышью по плоскости
            .onPlane(MouseEventType.Move, (event:MyMouseEvent) => {
                if (!section.resizing) return;

                let halfSize = sections.getDirectionSize() / 2, // половина размера.
                    minEdge = previous
                        ? previous.getWallComponent(sections.direction)
                        : -halfSize, // откуда считать ращзмер
                    mouseCoordinate = event.getPlaneIntersection().point.getComponent(sections.direction), // координата мыши
                    maxCoordinate = next
                        ? next.getWallComponent(sections.direction)
                        : +halfSize, // максимум координаты мыши
                    minCoordinate = minEdge, // минимум координаты мыши
                    minSectionSize = sections.thickness + sections.minSize; // минимальный размер секции

                // Добавляем минимальный размер секции к ограничениям.
                maxCoordinate -= minSectionSize;
                minCoordinate += minSectionSize;

                // Ограничения не позволяют перемещать секцию.
                if (minCoordinate > maxCoordinate) return;

                // Ограничиваем координату мыши
                mouseCoordinate = Math.min(mouseCoordinate, maxCoordinate);
                mouseCoordinate = Math.max(mouseCoordinate, minCoordinate);

                // Задаём размер секции и её изменение
                let size = mouseCoordinate - minEdge,
                    delta = size - section.getSizeComponent(this.direction);

                // Устанавливаем размер секции
                this.setSectionSizeComponent(section, size);

                // Если есть следуюшая секция - изменяем её размер обратно пропорционально текущей
                next && this.setSectionSizeComponent(next, next.getSizeComponent(this.direction) - delta);
            });
    }
}

// Внутренние секции шкафа
class Sections extends Object3D {
    protected sections:Section[] = [];
    protected sectionSize:V3;
    protected events:SectionsEvents;
    public innerResizing:boolean = false;

    constructor(public direction:SectionsDirection,
                protected mouseEventManager:MouseEventManager,
                protected size:V3,
                public thickness:number,
                protected amount = 3,
                public minSize = 20) {
        super();

        this.events = new SectionsEvents(mouseEventManager, this);
        this.sectionSize = size.clone();
        this.setAmount(amount);
    }

    getAll() {
        return this.sections;
    }

    setAmount(amount:number) {
        this.amount = amount;

        this.clear();

        let boundSize:number = this.getDirectionSize(),
            size:number = boundSize / amount,
            relativeSize:number = size / boundSize;

        this.sectionSize.setComponent(this.direction, size);

        for (let i = 0; i < amount; i++) {
            let section = this.createSection(relativeSize);
            this.sections.push(section);
            this.add(section);
        }

        // Удаляем стенку у последней секции
        this.sections[amount - 1].wall = null;

        this.updatePositionsAndSizesByRelative();
    }

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
        this.innerResizing = resizing;
        return this;
    }

    /**
     * Установить размер секции.
     *
     * @param section
     * @param size
     * @returns {Sections}
     */
    setSectionSizeComponent(section:Section, size:number) {
        section.setSizeComponent(this.direction, size);
        section.relativeSize = size / this.getDirectionSize();
        return this;
    }

    /**
     * Установить размер.
     *
     * @param index
     * @param size
     */
    setSizeComponent(index:number, size:number) {
        this.size.setComponent(index, size);
        this.updatePositionsAndSizesByRelative();
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
    updatePositionsAndSizesByRelative() {
        // Координата секции (x / y)
        let position = -this.getDirectionSize() / 2;

        this.sections.forEach((section:Section) => {
            // Размер секции
            let size:number = this.getDirectionSize() * section.relativeSize,
                half = size / 2;

            // Отодвигаем координату центра секции на половину размера.
            position += half;

            // Размер секции
            let sectionSize = this.size.clone();

            // Устанавливаем размер секции по направлению
            sectionSize.setComponent(this.direction, size);

            // Устанавливаем размер и положение секции
            section
                .setSize(sectionSize)
                .setPositionComponent(this.direction, position);

            position += half;
        });
        return this;
    }

    /**
     * Очистить секции
     *
     * @returns {Sections}
     */
    protected clear() {
        this.sections.forEach((section:Section) => this.remove(section));
        this.sections = [];
        return this;
    }

    getPrevious(section:Section) {
        return this.getNear(section, -1);
    }

    getNext(section:Section) {
        return this.getNear(section, +1);
    }

    protected getNear(section:Section, deltaIndex:number){
        for (var index in this.sections) {
            if (section == this.sections[index]) return this.sections[index + deltaIndex];
        }
    }
}


class WallSections extends Sections {

    constructor(mouseEventManager:MouseEventManager,
                boundSize:THREE.Vector3,
                thickness:number,
                amount:number,
                minWidth:number = 20) {
        super(
            SectionsDirection.Horizontal,
            mouseEventManager,
            boundSize,
            thickness,
            amount,
            minWidth
        );
    }

    protected createSection(relativeSize:number):Section {
        var size = this.size.clone(),
            direction = SectionsDirection.Vertical;

        size.setComponent(
            direction,
            relativeSize * this.getDirectionSize()
        );

        console.log(size, direction);

        var amount = Math.floor(Math.random() * 3) + 3;

        return (new WallSection(this.thickness, relativeSize, direction)).setShelves(
            new ShelfSections(
                this.mouseEventManager,
                size,
                this.thickness,
                amount
            )
        );
    }
}

class WallSection extends Section {
    protected shelves:ShelfSections;

    constructor(thickness:number, relativeSize:number, direction:SectionsDirection) {
        super(thickness, relativeSize, direction);
    }

    setShelves(shelves:ShelfSections) {
        this.add(this.shelves = shelves);
        return this;
    }
}

class ShelfSections extends Sections {
    constructor(mouseEventManager:MouseEventManager,
                boundSize:THREE.Vector3,
                thickness:number,
                amount:number,
                minSize:number = 20) {
        super(
            SectionsDirection.Vertical,
            mouseEventManager,
            boundSize,
            thickness,
            amount,
            minSize
        );
    }
}


class Cupboard extends Object3D {
    protected walls:Walls;
    protected sections:Sections;

    constructor(protected mouseEventManager:MouseEventManager,
                protected size:V3 = new V3(300, 250, 60),
                protected thickness:number = 5,
                protected minSize:V3 = new V3(100, 100, 30),
                protected maxSize:V3 = new V3(500, 400, 100)) {
        super();
        this.walls = new Walls(size, thickness);

        // Количество секций
        var sectionsAmount = Math.floor(Math.random() * 3 + 3);
        this.sections = new WallSections(mouseEventManager, size, thickness, sectionsAmount);
        this.add(this.walls);
        this.add(this.sections);

        this.listen();
    }

    listen() {
        let change = new V3(),
            initPoint:V3,
            initSize:V3;

        this.mouseEventManager
            .onPlane(MouseEventType.Move, (event:MyMouseEvent) => {
                if (!initPoint) return;

                let point = event.getPlaneIntersection().point;
                for (let i = 0; i < 3; i++) {
                    // Какую координату мыши получаем (x / y)
                    var mouseIndex = i == 2 ? 0 : i,
                        size = initSize.getComponent(i) + point.getComponent(mouseIndex) - initPoint.getComponent(mouseIndex);
                    change.getComponent(i) && this.setSizeComponent(i, size);
                }
            })
            .onPlane(MouseEventType.Up, () => {
                change.set(0, 0, 0);
            })
            .onPlane(MouseEventType.Down, (event:MyMouseEvent) => {
                initPoint = event.getPlaneIntersection().point;
                initSize = this.size.clone();
            })
            .onObject(MouseEventType.Down, this.walls.right, () => {
                change.x = 1;
            })
            .onObject(MouseEventType.Down, this.walls.bottom, () => {
                change.y = 1;
            })
            .onObject(MouseEventType.Down, this.walls.left, () => {
                change.z = 1;
            })
            .onObject(MouseEventType.Down, this.walls.top, () => {
                change.z = 1;
            });
    }

    setSizeComponent(index:number, size:number):Cupboard {
        size = Math.max(size, this.minSize.getComponent(index));
        size = Math.min(size, this.maxSize.getComponent(index));
        this.size.setComponent(index, size);
        this.walls.setSizeComponent(index, size);
        this.sections.setSizeComponent(index, size);
        return this;
    }
}

class Walls extends Object3D {
    public left:Wall;
    public right:Wall;
    public top:Wall;
    public bottom:Wall;
    public back:Wall;

    constructor(protected boundSize:V3, protected thickness:number) {
        super();

        this
            .createLeftRight(boundSize, thickness)
            .createTopBottom(boundSize, thickness)
            .createBack(boundSize, thickness);
    }

    // Левая и правая стена
    protected createLeftRight(boundSize:V3, thickness:number):Walls {
        let size = boundSize.clone().setX(thickness);
        let position = new V3((thickness - boundSize.x) / 2, 0, 0);
        this.left = new Wall(size, position);

        position.x *= -1;
        this.right = new Wall(size, position);

        this.add(this.left);
        this.add(this.right);
        return this;
    }

    // Верхняя и нижняя стена
    protected createTopBottom(boundSize:V3, thickness:number):Walls {
        let size = boundSize.clone().setY(thickness).setX(boundSize.x - thickness * 2);
        let position = new V3(0, (boundSize.y - thickness) / 2, 0);
        this.top = new Wall(size, position);
        position.y *= -1;
        this.bottom = new Wall(size, position);
        this.add(this.top);
        this.add(this.bottom);
        return this;
    }

    // Задняя стена
    protected createBack(boundSize:V3, thickness:number):Walls {
        let size = boundSize.clone().setZ(thickness);
        let position = new V3(0, 0, -boundSize.z / 2);
        this.back = new Wall(size, position);
        this.add(this.back);
        return this;
    }

    setSizeComponent(index:number, size:number) {
        this.boundSize.setComponent(index, size);

        let half:number = size / 2,
            resizables:Wall[] = [];

        switch (index) {
            case 0:
                this.right.position.x = half;
                this.left.position.x = -half;
                resizables = [
                    this.top,
                    this.bottom,
                    this.back
                ];
                break;

            case 1:
                this.top.position.y = half;
                this.bottom.position.y = -half;
                resizables = [
                    this.left,
                    this.right,
                    this.back
                ];
                break;

            case 2:
                this.back.position.z = -half;
                resizables = [
                    this.left,
                    this.right,
                    this.top,
                    this.bottom
                ];
                break;
        }

        resizables.forEach((wall:Wall) => wall.scale.setComponent(index, size));

        return this;
    }
}