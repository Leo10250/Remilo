package com.remilo.alarm.media

import android.os.Bundle
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.PickVisualMediaRequest
import java.util.concurrent.ConcurrentHashMap

/** Transient picker transport only; it owns no authored plan or durable progress. */
class ExercisePhotoActivity : ComponentActivity() {
  private val picker = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
    callbacks.remove(intent.getStringExtra("request"))?.invoke(uri); finish()
  }
  override fun onCreate(state: Bundle?) {
    super.onCreate(state)
    if (state == null) picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
  }
  companion object { val callbacks = ConcurrentHashMap<String, (Uri?) -> Unit>() }
}
