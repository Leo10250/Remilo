package com.remilo.alarm.system

import android.app.Application
import android.graphics.BitmapFactory
import com.remilo.alarm.R
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/** Packaging/decoding evidence only; this is not native layout or device acceptance. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class AtmosphereAssetsTest {
  @Test fun allEightApprovedBundledScenesHaveReadableImageBounds() {
    val resources = RuntimeEnvironment.getApplication().resources
    listOf(R.drawable.remilo_scene_sunrise_light_v1, R.drawable.remilo_scene_sunrise_dark_v1,
      R.drawable.remilo_scene_sky_light_v1, R.drawable.remilo_scene_sky_dark_v1,
      R.drawable.remilo_scene_evening_light_v1, R.drawable.remilo_scene_evening_dark_v1,
      R.drawable.remilo_scene_night_light_v2, R.drawable.remilo_scene_night_dark_v2).forEach { id ->
      val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeResource(resources, id, options)
      assertTrue(resources.getResourceName(id), options.outWidth > 0 && options.outHeight > 0)
    }
  }
}
