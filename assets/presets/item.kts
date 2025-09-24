import net.minecraft.resources.ResourceLocation
import net.minecraftforge.event.entity.player.PlayerEvent
import net.minecraftforge.registries.ForgeRegistries
import ru.hollowhorizon.hc.client.utils.rl
import ru.hollowhorizon.hollowengine.common.scripting.story.nodes.IContextBuilder
import ru.hollowhorizon.hollowengine.common.scripting.story.nodes.base.waitForgeEvent

// Ждать, пока количество предмета в инвентаре игрока удовлетворит сравнению
fun IContextBuilder.waitItemCount(op: String, itemId: String, count: Int) {
    waitForgeEvent<PlayerEvent> { event ->
        val item = ForgeRegistries.ITEMS.getValue(itemId.rl) ?: return@waitForgeEvent false
        var total = 0
        for (stack in event.entity.inventory.items) {
            if (stack.item == item) total += stack.count
        }
        when (op) {
            ">" -> total > count
            "<" -> total < count
            ">=" -> total >= count
            "<=" -> total <= count
            "==" -> total == count
            else -> false
        }
    }
}


