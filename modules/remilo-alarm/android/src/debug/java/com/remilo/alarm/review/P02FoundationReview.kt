package com.remilo.alarm.review

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.engine.AlarmEngine
import com.remilo.alarm.foundation.*
import com.remilo.alarm.system.AlarmControlsScreen
import com.remilo.alarm.system.AlarmControlStyle

@Composable
internal fun P02FoundationReview(config: AlarmReviewConfiguration, snapshot: AlarmEngine.SessionSnapshot?,
  feedback: String?, onAction: (String, AlertRecord?) -> Unit, onRetry: () -> Unit) {
  val brightness = if (config.dark) Brightness.Dark else Brightness.Light
  val generic = config.scenario == AlarmReviewScenario.Generic
  val source = if (config.invalidTokens) FoundationCatalog.colors.mapValues { (id, value) ->
    if (id == config.palette.lowercase()) value.mapValues { emptyMap() } else value } else FoundationCatalog.colors
  val requested = Foundations.lookup(if (generic) "classic" else config.palette.lowercase(), brightness, source)
  val f = if (config.missingArt) Foundations.missingArt(requested) else requested
  val resources = LocalContext.current.resources
  val asset = f.scene?.let { resources.getIdentifier(it, "drawable", LocalContext.current.packageName) } ?: 0
  val foundation = if (f.scene != null && asset == 0) Foundations.missingArt(f) else f
  fun c(role: String) = Color(foundation.colors.getValue(role))
  fun ink(role: String) = if (config.sampleBackground) Color.Transparent else c(role)
  fun mapped(role: String, foreground: Boolean = false): Color {
    val value = FoundationCatalog.composeMapping.getValue(role)
    val color = if (value.startsWith("#")) Color(android.graphics.Color.parseColor(value)) else c(value)
    return if (foreground && config.sampleBackground) Color.Transparent else color
  }
  val base = if (config.dark) darkColorScheme() else lightColorScheme()
  val scheme = base.copy(primary=mapped("primary"),onPrimary=mapped("onPrimary",true),primaryContainer=mapped("primaryContainer"),onPrimaryContainer=mapped("onPrimaryContainer",true),
    inversePrimary=mapped("inversePrimary",true),secondary=mapped("secondary"),onSecondary=mapped("onSecondary",true),secondaryContainer=mapped("secondaryContainer"),onSecondaryContainer=mapped("onSecondaryContainer",true),
    tertiary=mapped("tertiary"),onTertiary=mapped("onTertiary",true),tertiaryContainer=mapped("tertiaryContainer"),onTertiaryContainer=mapped("onTertiaryContainer",true),
    background=mapped("background"),onBackground=mapped("onBackground",true),surface=mapped("surface"),onSurface=mapped("onSurface",true),surfaceVariant=mapped("surfaceVariant"),onSurfaceVariant=mapped("onSurfaceVariant",true),
    surfaceTint=mapped("surfaceTint"),inverseSurface=mapped("inverseSurface"),inverseOnSurface=mapped("inverseOnSurface",true),error=mapped("error",true),onError=mapped("onError",true),errorContainer=mapped("errorContainer"),onErrorContainer=mapped("onErrorContainer",true),
    outline=mapped("outline"),outlineVariant=mapped("outlineVariant"),scrim=mapped("scrim"),surfaceBright=mapped("surfaceBright"),surfaceDim=mapped("surfaceDim"),surfaceContainer=mapped("surfaceContainer"),surfaceContainerHigh=mapped("surfaceContainerHigh"),surfaceContainerHighest=mapped("surfaceContainerHighest"),surfaceContainerLow=mapped("surfaceContainerLow"),surfaceContainerLowest=mapped("surfaceContainerLowest"))
  val baseType = Typography()
  val type = Typography(headlineLarge=baseType.headlineLarge.copy(fontSize=28.sp,lineHeight=39.2.sp,fontWeight=FontWeight.SemiBold),
    headlineMedium=baseType.headlineMedium.copy(fontSize=28.sp,lineHeight=39.2.sp),titleLarge=baseType.titleLarge.copy(fontSize=22.sp,lineHeight=30.8.sp),
    titleMedium=baseType.titleMedium.copy(fontSize=16.sp,lineHeight=22.4.sp),bodyLarge=baseType.bodyLarge.copy(fontSize=16.sp,lineHeight=22.4.sp),
    bodyMedium=baseType.bodyMedium.copy(fontSize=14.sp,lineHeight=19.6.sp),labelLarge=baseType.labelLarge.copy(fontSize=14.sp,lineHeight=19.6.sp),labelSmall=baseType.labelSmall.copy(fontSize=12.sp,lineHeight=16.8.sp))
  val density = LocalDensity.current
  CompositionLocalProvider(LocalDensity provides Density(density.density,config.fontScale)) {
    MaterialTheme(colorScheme=scheme,typography=type,shapes=Shapes(small=RoundedCornerShape(12.dp),medium=RoundedCornerShape(16.dp),large=RoundedCornerShape(24.dp))) {
      BoxWithConstraints(Modifier.fillMaxSize().background(c("background")).semantics { stateDescription = "P02 ${foundation.id}; ${foundation.fallback}" }) {
        val placement = foundation.placement(if (config.p02Primitives) "browsing" else "individual")
        val artHeight = minOf(maxHeight * (placement?.heightFraction ?: 0f), maxWidth * if (placement?.edge == "top") 1.5f else 2f/3f)
        val backdrop: @Composable BoxScope.() -> Unit = {
          if (asset != 0 && foundation.scene != null) Image(painterResource(asset),null,contentScale=ContentScale.Crop,
            alignment=if (placement?.edge == "top") Alignment.TopCenter else Alignment.BottomCenter,
            modifier=Modifier.align(if (placement?.edge == "top") Alignment.TopCenter else Alignment.BottomCenter).fillMaxWidth().height(artHeight).clearAndSetSemantics {})
        }
        if (config.p02Primitives) {
          backdrop()
          Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp).widthIn(max=480.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Surface(shape=RoundedCornerShape(16.dp)) { Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
              Text("Compose controls",style=type.titleLarge)
              Text("Actual Material controls",style=type.bodyMedium,color=ink("muted"))
              Button(onClick=onRetry,shape=RoundedCornerShape(12.dp),modifier=Modifier.heightIn(min=48.dp)) { Text("Default") }
              Button(onClick=onRetry,colors=ButtonDefaults.buttonColors(containerColor=c("primaryPressed"),contentColor=ink("onPrimaryPressed")),shape=RoundedCornerShape(12.dp),modifier=Modifier.heightIn(min=48.dp)) { Text("Pressed treatment") }
              Box(Modifier.border(2.dp,c("focus"),RoundedCornerShape(16.dp)).padding(4.dp)) { OutlinedButton(onClick=onRetry,shape=RoundedCornerShape(12.dp),modifier=Modifier.heightIn(min=48.dp)) { Text("Focused treatment") } }
              Row(verticalAlignment=Alignment.CenterVertically) { RadioButton(selected=true,onClick=onRetry); Text("Selected option") }
              Row(verticalAlignment=Alignment.CenterVertically) { RadioButton(selected=false,onClick=onRetry); Text("Unselected option") }
              Button(onClick=onRetry,enabled=false,colors=ButtonDefaults.buttonColors(disabledContainerColor=c("disabledSurface"),disabledContentColor=ink("disabledInk")),shape=RoundedCornerShape(12.dp),modifier=Modifier.heightIn(min=48.dp)) { Text("Disabled") }
              Button(onClick=onRetry,enabled=false,colors=ButtonDefaults.buttonColors(disabledContainerColor=c("disabledSurface"),disabledContentColor=ink("disabledInk")),shape=RoundedCornerShape(12.dp),modifier=Modifier.heightIn(min=48.dp)) { Box(Modifier.size(20.dp)) { if (!config.sampleBackground) CircularProgressIndicator(color=c("disabledInk"),modifier=Modifier.size(20.dp),strokeWidth=2.dp) }; Spacer(Modifier.width(8.dp)); Text("Saving…") }
              OutlinedTextField(value="8:00 AM",onValueChange={},label={Text("Time")},isError=true,supportingText={Text("Choose a future time.")})
              Row(verticalAlignment=Alignment.CenterVertically) { Checkbox(checked=true,onCheckedChange={onRetry()}); Text("Use vibration") }
              Text("Could not apply this action. Try again.",color=ink("danger")); TextButton(onClick=onRetry) { Text("Retry",color=ink("accent")) }
            } }
          }
        } else AlarmControlsScreen(snapshot,config.p02Busy,feedback ?: if (config.scenario == AlarmReviewScenario.Error) "Could not apply this action. Try again." else null,
          onAction,onRetry,backdrop=backdrop,
          controlStyle=AlarmControlStyle(ButtonDefaults.buttonColors(containerColor=c("accent"),contentColor=ink("accentInk"),disabledContainerColor=c("disabledSurface"),disabledContentColor=ink("disabledInk")),
            ButtonDefaults.outlinedButtonColors(contentColor=ink("ink"),disabledContentColor=ink("disabledInk"),disabledContainerColor=c("disabledSurface")),RoundedCornerShape(12.dp)),
          deliveryLabel={ if(!generic) Text("Event 10:00 AM · Due 9:00 AM",style=type.bodyMedium,color=ink("muted")); Text("Current ringing delivery",style=type.bodyMedium,color=ink("muted")) },
          singlePresentation={ information,actions,status ->
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(16.dp)) {
              Surface(shape=RoundedCornerShape(16.dp),modifier=Modifier.widthIn(max=480.dp).fillMaxWidth()) {
                Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                  Text("Remilo",style=type.titleMedium,color=ink("muted"))
                  MaterialTheme(colorScheme=if (config.sampleBackground) scheme.copy(primary=Color.Transparent) else scheme,content=information)
                }
              }
              Surface(shape=RoundedCornerShape(16.dp),modifier=Modifier.widthIn(max=480.dp).fillMaxWidth()) {
                Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                  actions(); MaterialTheme(colorScheme=if (config.sampleBackground) scheme.copy(primary=Color.Transparent) else scheme,content=status)
                }
              }
            }
          })
      }
    }
  }
}
