package com.remilo.alarm.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import java.io.File
import java.security.MessageDigest
import java.util.UUID

class ExerciseImageException(val code: String) : IllegalArgumentException(code)

/** Immutable CE files. All reference/lease mutations are called on the engine worker. */
class ExerciseImages(private val context: Context) {
  private val root get() = File(context.filesDir, "exercise-images").apply { mkdirs() }
  private val leases get() = context.getSharedPreferences("exercise-image-leases", Context.MODE_PRIVATE)
  fun file(id: String): File { require(id.matches(Regex("[a-f0-9]{64}"))); return File(root, "$id.webp") }
  fun lease(id: String, lease: String) { require(lease.length in 1..200); check(leases.edit().putString(lease, "$id:${System.currentTimeMillis()}").commit()) }
  fun release(lease: String) {
    val edit = leases.edit(); leases.all.keys.filter { it == lease || it.startsWith("$lease:") }.forEach { edit.remove(it) }; check(edit.commit())
  }
  fun active(): Set<String> {
    val cutoff = System.currentTimeMillis() - 86_400_000
    return leases.all.mapNotNull { (key, raw) ->
      val value = raw as? String ?: return@mapNotNull null
      if ((value.substringAfter(':').toLongOrNull() ?: 0) < cutoff) { release(key); null } else value.substringBefore(':')
    }.toSet()
  }
  fun referenced(db: ContentDatabase): Set<String> {
    val ids = mutableSetOf<String>()
    fun collect(text: String) { Regex("\"customImageId\"\\s*:\\s*\"([a-f0-9]{64})\"").findAll(text).forEach { ids.add(it.groupValues[1]) } }
    db.routines().versions().forEach { collect(it.days) }; db.routines().sessions().forEach { collect(it.steps) }
    return ids
  }
  fun clean(db: ContentDatabase) {
    val keep = referenced(db) + active(); val cutoff = System.currentTimeMillis() - 86_400_000
    root.listFiles().orEmpty().filter { it.nameWithoutExtension !in keep && it.lastModified() < cutoff }.forEach {
      if (it.delete()) db.routines().removeImage(it.nameWithoutExtension)
    }
    context.cacheDir.listFiles().orEmpty().filter { it.name.startsWith("exercise-source-") && it.lastModified() < cutoff }.forEach { it.delete() }
  }
  /** Run only on an I/O executor; the result is registered/leased before returning to JS. */
  fun normalize(uri: Uri): ExerciseImage {
    val input = File(context.cacheDir, "exercise-source-${UUID.randomUUID()}")
    val output = File(root, "staging-${UUID.randomUUID()}")
    try {
      context.contentResolver.openInputStream(uri)!!.use { source -> input.outputStream().use { sink ->
        val buffer = ByteArray(8192); var count = 0L
        while (true) { val n = source.read(buffer); if (n < 0) break; count += n; if(count > 50L * 1024 * 1024) throw ExerciseImageException("IMAGE_SOURCE_TOO_LARGE"); sink.write(buffer, 0, n) }
      } }
      val bitmap = ImageDecoder.decodeBitmap(ImageDecoder.createSource(input)) { decoder, info, _ ->
        if(info.mimeType == "image/gif" || info.isAnimated) throw ExerciseImageException("IMAGE_UNSUPPORTED")
        require(info.size.width > 0 && info.size.height > 0)
        val factor = minOf(1.0, 2048.0 / maxOf(info.size.width, info.size.height))
        decoder.setTargetSize(maxOf(1, (info.size.width * factor).toInt()), maxOf(1, (info.size.height * factor).toInt()))
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
      }
      val width = bitmap.width; val height = bitmap.height
      try { output.outputStream().use { require(bitmap.compress(Bitmap.CompressFormat.WEBP_LOSSY, 90, it)) } } finally { bitmap.recycle() }
      if(output.length() > 4L * 1024 * 1024) throw ExerciseImageException("IMAGE_OUTPUT_TOO_LARGE")
      val id = hash(output); val destination = file(id)
      if (!destination.exists() || hash(destination) != id) install(output,destination)
      return ExerciseImage(id, "image/webp", width, height, destination.length())
    } finally { input.delete(); output.delete() }
  }
  companion object {
    fun install(staged: File, destination: File) {
      try { java.nio.file.Files.move(staged.toPath(),destination.toPath(),java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING) }
      catch (_: java.nio.file.AtomicMoveNotSupportedException) { java.nio.file.Files.move(staged.toPath(),destination.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING) }
    }
    fun hash(file: File): String {
      val digest = MessageDigest.getInstance("SHA-256")
      file.inputStream().use { stream -> val buffer = ByteArray(8192); while (true) { val n = stream.read(buffer); if (n < 0) break; digest.update(buffer, 0, n) } }
      return digest.digest().joinToString("") { "%02x".format(it) }
    }
  }
}
