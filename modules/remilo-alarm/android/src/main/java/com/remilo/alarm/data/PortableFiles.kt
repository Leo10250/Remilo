package com.remilo.alarm.data

import android.content.Context
import android.net.Uri
import android.graphics.BitmapFactory
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/** Bounded streaming archive I/O; never runs on the alarm mutation worker. */
class PortableFiles(private val context: Context) {
  private val imports get() = File(context.filesDir, "prepared-imports").apply { mkdirs() }
  fun directory(handle: String): File { require(handle.matches(Regex("[a-f0-9-]{36}"))); return File(imports, handle) }
  fun discard(handle: String) {
    val dir = directory(handle); require(dir.canonicalFile.parentFile == imports.canonicalFile); dir.deleteRecursively()
  }
  fun export(json: String, images: List<ExerciseImage>): Map<String, Any> {
    val destination = File(File(context.cacheDir,"remilo-exports").apply { mkdirs() }, "remilo-${System.currentTimeMillis()}.remilo")
    try {
      var total = json.toByteArray().size.toLong()
      require(total + images.sumOf { it.bytes } <= LIMIT)
      ZipOutputStream(destination.outputStream()).use { zip ->
        zip.putNextEntry(ZipEntry("content.json")); zip.write(json.toByteArray(Charsets.UTF_8)); zip.closeEntry()
        images.forEach { image ->
          val source = ExerciseImages(context).file(image.id)
          require(source.length() == image.bytes && ExerciseImages.hash(source) == image.id)
          zip.putNextEntry(ZipEntry("media/${image.id}.webp")); source.inputStream().use { it.copyTo(zip) }; zip.closeEntry()
        }
      }
      require(destination.length() <= LIMIT)
      return mapOf("uri" to Uri.fromFile(destination).toString(), "imageCount" to images.size, "bytes" to destination.length())
    } catch (error: Exception) { destination.delete(); throw error }
  }
  fun prepare(uri: Uri): String {
    val handle = UUID.randomUUID().toString(); val dir = directory(handle).apply { mkdirs() }
    try {
      val source = File(dir, "source")
      context.contentResolver.openInputStream(uri)!!.use { input -> source.outputStream().use { output -> copy(input,output,LIMIT) } }
      val zip = source.inputStream().use { it.read() == 0x50 && it.read() == 0x4b }
      if (zip) {
        var total = 0L; val names = mutableSetOf<String>()
        ZipInputStream(source.inputStream()).use { input ->
          while (true) {
            val entry = input.nextEntry ?: break
            require(!entry.isDirectory && (entry.name == "content.json" || entry.name.matches(Regex("media/[a-f0-9]{64}\\.webp"))) && names.add(entry.name))
            val destination = File(dir, entry.name).apply { parentFile!!.mkdirs() }
            val maximum = if (entry.name == "content.json") 10_000_000L else 4L*1024*1024
            val bytes = destination.outputStream().use { copy(input,it,minOf(maximum,LIMIT-total)) }; total += bytes
            require(total <= LIMIT); input.closeEntry()
          }
        }
        require("content.json" in names)
        val root = JSONObject(File(dir,"content.json").readText()); require(root.getInt("version") == 7)
        val bundle = BackupCodec.decode(root.toString())
        require(names == setOf("content.json") + bundle.images.map { "media/${it.id}.webp" })
      } else { require(source.length() <= 10_000_000); require(source.renameTo(File(dir,"content.json"))) }
      val bundle = validate(handle)
      // A plain JSON file cannot provide new custom image payloads.
      require(zip || bundle.images.isEmpty())
      source.delete(); return handle
    } catch (error: Exception) { dir.deleteRecursively(); throw error }
  }
  fun validate(handle: String): BackupCodec.Bundle {
    val dir = directory(handle); val metadata = File(dir,"content.json")
    require(metadata.length() in 1..10_000_000)
    val bundle = BackupCodec.decode(metadata.readText())
    bundle.images.forEach { image ->
      val file = File(dir,"media/${image.id}.webp")
      require(file.isFile && file.length() == image.bytes && ExerciseImages.hash(file) == image.id)
      val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeFile(file.path,options)
      require(options.outWidth == image.width && options.outHeight == image.height && options.outMimeType == "image/webp")
      android.graphics.ImageDecoder.decodeBitmap(android.graphics.ImageDecoder.createSource(file)) { decoder, info, _ ->
        require(!info.isAnimated); decoder.allocator = android.graphics.ImageDecoder.ALLOCATOR_SOFTWARE
      }.recycle()
    }
    return bundle
  }
  fun install(handle: String, bundle: BackupCodec.Bundle) {
    bundle.images.forEach { image ->
      val destination = ExerciseImages(context).file(image.id)
      if (!destination.exists() || ExerciseImages.hash(destination) != image.id) {
        val staged = File(destination.parentFile,"install-${UUID.randomUUID()}")
        try { File(directory(handle),"media/${image.id}.webp").inputStream().use { input -> staged.outputStream().use { input.copyTo(it) } }; ExerciseImages.install(staged,destination) }
        finally { staged.delete() }
      }
    }
  }
  companion object {
    const val LIMIT = 200L * 1024 * 1024
    private fun copy(input: java.io.InputStream, output: java.io.OutputStream, limit: Long): Long {
      var count = 0L; val buffer = ByteArray(8192)
      while (true) { val n = input.read(buffer); if(n < 0) return count; count += n; require(count <= limit); output.write(buffer,0,n) }
    }
  }
}
