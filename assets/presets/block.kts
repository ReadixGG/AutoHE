import net.minecraft.core.BlockPos
import net.minecraftforge.event.entity.player.PlayerInteractEvent
import net.minecraftforge.registries.ForgeRegistries
import ru.hollowhorizon.hc.client.utils.rl
import ru.hollowhorizon.hollowengine.common.scripting.story.nodes.IContextBuilder
import ru.hollowhorizon.hollowengine.common.scripting.story.nodes.base.waitForgeEvent

// Ожидание клика по блоку с проверкой id (mod:id)
fun IContextBuilder.waitLeftBlockInteract(block: String, x: Int, y: Int, z: Int) {
    waitForgeEvent<PlayerInteractEvent.LeftClickBlock> { event ->
        val pos = event.pos
        pos == BlockPos(x, y, z) && event.level.getBlockState(pos).block == ForgeRegistries.BLOCKS.getValue(block.rl)
    }
}
fun IContextBuilder.waitRightBlockInteract(block: String, x: Int, y: Int, z: Int) {
    waitForgeEvent<PlayerInteractEvent.RightClickBlock> { event ->
        val pos = event.pos
        pos == BlockPos(x, y, z) && event.level.getBlockState(pos).block == ForgeRegistries.BLOCKS.getValue(block.rl)
    }
}

// Перегрузки: только по координате блока (без проверки id)
fun IContextBuilder.waitLeftBlockInteract(x: Int, y: Int, z: Int) {
    waitForgeEvent<PlayerInteractEvent.LeftClickBlock> { event ->
        event.pos == BlockPos(x, y, z)
    }
}
fun IContextBuilder.waitRightBlockInteract(x: Int, y: Int, z: Int) {
    waitForgeEvent<PlayerInteractEvent.RightClickBlock> { event ->
        event.pos == BlockPos(x, y, z)
    }
}


