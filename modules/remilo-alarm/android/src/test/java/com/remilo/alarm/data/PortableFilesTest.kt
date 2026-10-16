package com.remilo.alarm.data

import android.app.Application
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.UserManager
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[34],application=Application::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PortableFilesTest {
  private lateinit var context: Context
  @Before fun setup() { context=RuntimeEnvironment.getApplication(); shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true) }
  private fun photo(width: Int=100,height: Int=200): File {
    val file=File(context.cacheDir,"photo.png"); val bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888)
    bitmap.eraseColor(android.graphics.Color.argb(100,200,120,60)); file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG,100,it) }; bitmap.recycle(); return file
  }
  @Test fun normalizesWithoutCroppingPreservesAlphaAndDeduplicatesByContent() {
    val store=ExerciseImages(context); val image=store.normalize(Uri.fromFile(photo()))
    assertEquals(100,image.width); assertEquals(200,image.height)
    assertEquals(image.id,store.normalize(Uri.fromFile(photo())).id)
    assertEquals(image.id,ExerciseImages.hash(store.file(image.id)))
    val decoded=android.graphics.BitmapFactory.decodeFile(store.file(image.id).path); assertTrue(decoded.hasAlpha()); decoded.recycle()
  }
  @Test fun downsamplesTheWholeFrameAndRejectsInvalidContent() {
    val image=ExerciseImages(context).normalize(Uri.fromFile(photo(3000,1000)))
    assertEquals(2048,image.width); assertEquals(682,image.height)
    val invalid=File(context.cacheDir,"invalid.png").apply { writeText("not an image") }
    assertThrows(Exception::class.java) { ExerciseImages(context).normalize(Uri.fromFile(invalid)) }
  }
  @Test fun appliesJpegOrientationAndRejectsOversizedSourcesWithASpecificError() {
    val bitmap=Bitmap.createBitmap(100,200,Bitmap.Config.ARGB_8888)
    val bytes=java.io.ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.JPEG,90,it) }.toByteArray(); bitmap.recycle()
    // EXIF IFD0 Orientation=6 (90 degrees clockwise), with the entire frame retained.
    val exif="ffe1002245786966000049492a0008000000010012010300010000000600000000000000".chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    val source=File(context.cacheDir,"oriented.jpg").apply { outputStream().use { it.write(bytes,0,2); it.write(exif); it.write(bytes,2,bytes.size-2) } }
    val image=ExerciseImages(context).normalize(Uri.fromFile(source))
    assertEquals(200,image.width); assertEquals(100,image.height)
    val oversized=File(context.cacheDir,"oversized.jpg")
    java.io.RandomAccessFile(oversized,"rw").use { it.setLength(50L*1024*1024+1) }
    val error=assertThrows(ExerciseImageException::class.java) { ExerciseImages(context).normalize(Uri.fromFile(oversized)) }
    assertEquals("IMAGE_SOURCE_TOO_LARGE",error.code)
  }
  @Test fun archiveIncludesValidatedImagesAndLegacyJsonStillPrepares() {
    val image=ExerciseImages(context).normalize(Uri.fromFile(photo()))
    val json=BackupCodec.encode(emptyList(),emptyMap(),emptyList(),0,images=listOf(image))
    val files=PortableFiles(context); val archive=files.export(json,listOf(image)); val handle=files.prepare(Uri.parse(archive["uri"] as String))
    assertEquals(listOf(image),files.validate(handle).images)
    val legacy=JSONObject(BackupCodec.encode(emptyList(),emptyMap(),emptyList(),0)).put("version",6).toString()
    val source=File(context.cacheDir,"legacy.json").apply { writeText(legacy) }
    assertTrue(files.validate(files.prepare(Uri.fromFile(source))).images.isEmpty())
  }
  @Test fun cleanupRetainsLeasedImagesAndRemovesOnlyAbandonedOldFiles() {
    val db=androidx.room.Room.inMemoryDatabaseBuilder(context,ContentDatabase::class.java).allowMainThreadQueries().build()
    try {
      val store=ExerciseImages(context); val image=store.normalize(Uri.fromFile(photo())); db.routines().image(image)
      val old=System.currentTimeMillis()-172_800_000
      store.file(image.id).setLastModified(old); store.lease(image.id,"export:${image.id}")
      val abandoned=File(context.cacheDir,"exercise-source-abandoned").apply { writeText("stale source"); setLastModified(old) }
      store.clean(db); assertTrue(store.file(image.id).exists()); assertFalse(abandoned.exists())
      store.release("export"); store.clean(db)
      assertFalse(store.file(image.id).exists()); assertNull(db.routines().image(image.id))
    } finally { db.close() }
  }
  @Test fun rejectsTraversalMissingImagesAndCorruptPayloadBeforeImport() {
    val files=PortableFiles(context); val archive=File(context.cacheDir,"unsafe.remilo")
    ZipOutputStream(archive.outputStream()).use { it.putNextEntry(ZipEntry("../escape")); it.write(byteArrayOf(1)); it.closeEntry() }
    assertThrows(IllegalArgumentException::class.java) { files.prepare(Uri.fromFile(archive)) }
    val image=ExerciseImages(context).normalize(Uri.fromFile(photo()))
    val json=BackupCodec.encode(emptyList(),emptyMap(),emptyList(),0,images=listOf(image))
    ZipOutputStream(archive.outputStream()).use { it.putNextEntry(ZipEntry("content.json")); it.write(json.toByteArray()); it.closeEntry() }
    assertThrows(IllegalArgumentException::class.java) { files.prepare(Uri.fromFile(archive)) }
    ZipOutputStream(archive.outputStream()).use { it.putNextEntry(ZipEntry("content.json")); it.write(json.toByteArray()); it.closeEntry(); it.putNextEntry(ZipEntry("media/${image.id}.webp")); it.write(byteArrayOf(1)); it.closeEntry() }
    assertThrows(IllegalArgumentException::class.java) { files.prepare(Uri.fromFile(archive)) }
  }
}
