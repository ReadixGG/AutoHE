import ru.hollowhorizon.hollowengine.common.scripting.story.nodes.gui.gui
import ru.hollowhorizon.hollowengine.common.scripting.story.nodes.gui.widgets.*
import ru.hollowhorizon.hollowengine.common.scripting.story.nodes.IContextBuilder
import ru.hollowhorizon.hollowengine.common.entities.NPCEntity
import ru.hollowhorizon.hollowengine.common.util.Safe

/*
 * Меню выбора (центр экрана):
 * - Фон из presets/menu.png
 * - Вопрос в левом верхнем углу с отступом
 * - До 3 безфоновых кнопок под вопросом
 * - Справа сверху виджет сущности (NPC)
 *
 * Вызов: choiceMenu(question, options, npc)
 */

data class ChoiceOption(
    val text: String,
    val onClick: () -> Unit
)

fun IContextBuilder.choiceMenu(
    question: String,
    options: List<ChoiceOption>,
    npc: Safe<NPCEntity>?,
    settings: ChoiceMenuSettings = ChoiceMenuSettings()
) {
    gui {
        // Фон меню по центру. Подберите размер под фактическое изображение.
        // Примерные размеры (px). При необходимости измените.
        image(settings.backgroundTexture) {
            size(300.px, 180.px)
            align(Alignment.CENTER)
        }

        // Контейнер содержимого поверх фона
        container {
            size(300.px, 180.px)
            align(Alignment.CENTER)

            // Текст вопроса слева сверху с отступами
            label("${""}" + question + "${""}") {
                align(Alignment.TOP_LEFT)
                padding(left = 12.px, top = 12.px)
                color = settings.questionColor
            }

            // Заголовок "Вопрос" перед списком опций
            label("Вопрос") {
                align(Alignment.TOP_LEFT)
                padding(left = 12.px, top = 36.px)
                color = settings.questionColor
            }

            // Кнопки под вопросом (до 3)
            // Без фоновой текстуры, только текст. Размещаем столбцом с шагом.
            val maxButtons = 3
            val startYOffset = 60.px
            val stepY = 28.px

            options.take(maxButtons).forEachIndexed { index, opt ->
                val displayText = settings.optionPrefix + opt.text
                button(displayText, "") {
                    // Пустая текстура => без фона (движок отрисует только текст)
                    size(260.px, 22.px)
                    align(Alignment.TOP_LEFT)
                    padding(left = 12.px, top = (startYOffset + (stepY * index)).px)
                    anchor = Anchor.LEFT
                    color = settings.optionColor
                    hoverColor = settings.optionColor

                    onClick = {
                        opt.onClick()
                        close()
                    }
                }
            }

            // NPC справа сверху
            if (npc != null) {
                entity(npc) {
                    align(Alignment.TOP_RIGHT)
                    padding(right = 12.px, top = 12.px)
                    scale = 1.75f
                    entityX = 0.px
                    entityY = 35.px
                }
            }
        }
    }
}

data class ChoiceMenuSettings(
    val questionColor: Int = 0xFFFFFF,
    val optionColor: Int = 0xFFFFFF,
    val optionPrefix: String = "> ",
    val backgroundTexture: String = "presets/menu.png"
)


