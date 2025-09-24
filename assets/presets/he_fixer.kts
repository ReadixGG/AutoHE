import net.minecraft.core.BlockPos
import net.minecraft.nbt.CompoundTag
import net.minecraft.world.entity.Entity
import net.minecraft.world.phys.Vec3
import net.minecraft.world.InteractionHand
import net.minecraft.world.level.ClipContext
import ru.hollowhorizon.hollowengine.common.entities.NPCEntity
import ru.hollowhorizon.hollowengine.common.scripting.story.nodes.IContextBuilder
import ru.hollowhorizon.hollowengine.common.scripting.story.nodes.Node
import ru.hollowhorizon.hollowengine.common.scripting.story.nodes.base.*
import ru.hollowhorizon.hollowengine.common.scripting.story.nodes.npcs.*
import ru.hollowhorizon.hollowengine.common.scripting.story.StoryStateMachine
import ru.hollowhorizon.hollowengine.common.util.Safe
import kotlin.math.abs
import kotlin.math.sqrt
import java.util.*

// Блок-функции вынесены в block.kts

/*
 * HollowEngine FIXER.
 * При поддержке "HollowHorizon" & "_BENDY659_".
 * ----
 * Чинит почти всё, что плохо работает в Legacy версии мода.
 * Так же добавляет какие-то фишки.
*/

// Удалены дублирующиеся импорты ниже (были источником конфликтов)

val p by server.players

open class NpcMoveToBlockNodeFU(
	val npc: Safe<NPCEntity>,
	var poz: () -> Vec3,
	var dist: Double,
	var moveSpeed: Double
): Node() {
	val block by lazy{ poz() }

	override fun tick(): Boolean {
		if(!npc.isLoaded) return true

		val nav = npc().navigation
		val distance = npc().distanceToXZ(block) > dist

		nav.moveTo(nav.createPath(block.x, block.y, block.z, 0), moveSpeed)
		
		if(!distance) nav.stop()

		return distance || abs(npc().y - block.y) > 3
	}

	override fun serializeNBT() = CompoundTag().apply {
		putDouble("pos_x", block.x)
		putDouble("pos_y", block.y)
		putDouble("pos_z", block.z)
	}
	override fun deserializeNBT(nbt: CompoundTag) {
		poz = { Vec3(nbt.getDouble("pos_x"), nbt.getDouble("pos_y"), nbt.getDouble("pos_z")) }
	}
}

// Методы //

/**
 * Метод для НИПа по передвижению до точки.
 * @param npc НИп. Тот ним, с кем будете работать.
 * @param target Цель. Может быть и координатами или Конкретной сущностью.
 * @param dist Дистанция. Расстояние, до которой НИП может идти и после которого - должен остановится.
 * @param moveSpeed Скорость передвижения. Скорость, с которой будет двигаться НИП до точки.
 * @author Оригинала: HollowHorizon, переделанного: _BENDY659_.
*/
fun IContextBuilder.fmoveTo(
	npc: Safe<NPCEntity>,
	target: () -> Vec3,
	dist: Double = 1.0,
	moveSpeed: Double = 1.0
) {
	if( dist >= 0.3 )
		+NpcMoveToBlockNodeFU(npc, target, dist, moveSpeed)
	else
		throw IllegalArgumentException("Не рекомендуется ставить значение дистанции - меньше 0.3!")
}

/**
 * Методя для НИПа по ломанию блока в позиции.
 * @param npc НИп. Тот ним, с кем будете работать.
 * @param target Цель. Может быть и координатами или Конкретной сущностью.
 * @param delay Задержка. Перед, как НИП сломает блок и до того, когда махнёт рукой.
*/
fun IContextBuilder.fdestroyBlock(npc: Safe<NPCEntity>, target: () -> Vec3, delay: Int = 0) {
	+NpcMoveToBlockNodeFU(npc, target, 1.25, 1.0)
	npc lookAt { target() }

	next { npc().swing(InteractionHand.MAIN_HAND) }
	wait { delay }
	next { npc().fakePlayer.gameMode.destroyBlock(BlockPos(target())) }
}

/**
 * Метод для НИПа по использованию юлока (имитация ПКМ)
 * @param npc НИп. Тот ним, с кем будете работать.
 * @param target Цель. Может быть и координатами или Конкретной сущностью.
 * @param delay Задержка. Перед, как НИП сломает блок и до того, когда махнёт рукой.
*/
fun IContextBuilder.fuseBlock(npc: Safe<NPCEntity>, target: () -> Vec3, delay: Int = 0) {
	+NpcMoveToBlockNodeFU(npc, target, 1.25, 1.0)
	npc lookAt { target() }
	next { npc().swing(InteractionHand.MAIN_HAND) }
	wait { delay }
	next {
		val hit = npc().level.clip(ClipContext(target(), target(), ClipContext.Block.OUTLINE, ClipContext.Fluid.NONE, npc()))
		val state = npc().level.getBlockState(hit.blockPos)
		state.use(npc().level, npc().fakePlayer, InteractionHand.MAIN_HAND, hit)
	}
}

// ---- //

fun Entity.distanceToXZ(pos: Vec3) = sqrt((x - pos.x) * (x - pos.x) + (z - pos.z) * (z - pos.z))
fun Entity.distanceToXZ(npc: Entity) = distanceToXZ(npc.position())
fun poz(x: Double, y: Double, z: Double): () -> Vec3 = { Vec3(x, y, z) }