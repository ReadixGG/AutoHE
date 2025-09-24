import ru.hollowhorizon.hollowengine.common.entities.NPCEntity
import ru.hollowhorizon.hollowengine.common.scripting.story.nodes.IContextBuilder
import ru.hollowhorizon.hollowengine.common.util.Safe
import net.minecraft.world.phys.Vec3
import kotlin.math.max
import kotlin.math.min

fun vec(yaw: Double, pitch: Double): Pair<Double, Double> = yaw to pitch

// Универсальная версия: angles() может вернуть Pair<Float/Double, Float/Double>
fun IContextBuilder.lookVec(npc: Safe<NPCEntity>, distance: Double = 4.0, angles: () -> Any) {
    fun clampPitch(p: Double): Double = max(-90.0, min(90.0, p))
    val a = angles()
    val pair: Pair<Double, Double> = if (a is Pair<*, *>) {
        ((a.first as Number).toDouble()) to ((a.second as Number).toDouble())
    } else 0.0 to 0.0

    val (dyaw, dpitch) = pair
    val baseYaw = try { npc().yHeadRot.toDouble() } catch (_: Throwable) { try { npc().yRot.toDouble() } catch (_: Throwable) { 0.0 } }
    val basePitch = try { npc().xRot.toDouble() } catch (_: Throwable) { 0.0 }
    val yawf = (baseYaw + dyaw).toFloat()
    val pitchf = clampPitch(basePitch + dpitch).toFloat()

    val target: () -> Vec3 = {
        val dir = Vec3.directionFromRotation(pitchf, yawf)
        val origin = npc().position().add(0.0, npc().eyeHeight.toDouble(), 0.0)
        origin.add(dir.scale(distance))
    }
    npc lookAt { target() }
    next {
        try { npc().setYHeadRot(yawf) } catch (_: Throwable) { try { npc().yHeadRot = yawf } catch (_: Throwable) { } }
        try { npc().setYRot(yawf) } catch (_: Throwable) { try { npc().yRot = yawf } catch (_: Throwable) { } }
        try { npc().setYBodyRot(yawf) } catch (_: Throwable) { try { npc().yBodyRot = yawf } catch (_: Throwable) { } }
        try { npc().setXRot(pitchf) } catch (_: Throwable) { try { npc().xRot = pitchf } catch (_: Throwable) { } }
    }
}
// Пример: lookVec(npc) { vec(45.0, -10.0) }
