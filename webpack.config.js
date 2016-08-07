// Подключаем webpack:
var webpack = require('webpack');

// Плагин с кэшированием чанков на фронте:
var ChunkManifestPlugin = require('chunk-manifest-webpack-plugin');

// Разработка закончена:
var isFinal = process.env.NODE_ENV === 'production';

// Папка с доступными JS и CSS:
var publicAssetsPath = __dirname + '/web/assets/';

// Настройки webpack:
module.exports = {
    // Разботаем в текущей папке:
    context: __dirname,

    entry: {
        // Точка входа:
        cupboard: './assets/ts/main.ts',

        // Сторонние скрипты:
        vendor: ['three', 'jquery']
    },

    // Собираем результат в файл%
    output: {
        path: publicAssetsPath,
        filename: '[name].bundle.js',
        chunkFilename: '[id].bundle.js'
    },

    // При разработке создаём sourceMap:
    devtool: getSourceMapType(),

    resolve: {
        // Поддерживаемые расширения:
        extensions: [
            '',
            '.webpack.js',
            '.web.js',
            '.ts',
            '.js'
        ]
    },

    // Плагины для дополнительных настроек компиляции:
    plugins: getPlugins(),

    // Настройки модулей:
    module: {
        // Обработчики файлов при загрузке:
        loaders: [
            // Компилировать TypeScript:
            {
                test: /\.ts$/,
                loader: 'ts-loader'
            }
        ]
    }
};

/**
 * Тип sourcemap.
 *
 * @returns {*}
 */
function getSourceMapType(){
    // Выводим только для боевого:
    return isFinal ? 'source-map' : null;
}

/**
 * Получить плагины.
 *
 * @returns {*[]}
 */
function getPlugins() {
    var plugins = [
        // Плагин делает чанк vendor общим для всего кода:
        new webpack.optimize.CommonsChunkPlugin({
            name: 'vendor',
            minChunks: Infinity
        }),

        // Плагин позволяет кэшировать данные:
        new ChunkManifestPlugin()
    ];

    // В разработке дальнейшие скрипты нам не нужны:
    if (!isFinal) {
        return plugins;
    }

    // Ещё плагины:
    return plugins.concat([
        // Убираем дублирование:
        new webpack.optimize.DedupePlugin(),

        // Сортируем по появлению:
        new webpack.optimize.OccurenceOrderPlugin(),

        // Сжимаем файл:
        new webpack.optimize.UglifyJsPlugin(),
    ]);
}