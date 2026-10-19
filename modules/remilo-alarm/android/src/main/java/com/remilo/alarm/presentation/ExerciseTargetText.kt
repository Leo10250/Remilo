package com.remilo.alarm.presentation

import android.content.Context
import com.remilo.alarm.core.ExerciseTargets

fun exerciseTargetText(context: Context, step: Map<String,Any?>): String = ExerciseTargets.text(step) { key,args -> L10n.text(context,L10n.Message(key,args)) }
