# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.kts.

# Giữ lại các class của Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Giữ lại các class Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.lifecycle.HiltViewModel { *; }

# Giữ lại các class Kotlin Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.iotparking.app.**$$serializer { *; }
-keepclassmembers class com.iotparking.app.** {
    *** Companion;
}
-keepclasseswithmembers class com.iotparking.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Giữ lại Glance Widget
-keep class androidx.glance.** { *; }

# Giữ lại Vico Charts
-keep class com.patrykandpatrick.vico.** { *; }

# Giữ lại Coil
-keep class coil.** { *; }

# Giữ lại data classes cho Firestore
-keep class com.iotparking.app.data.model.** { *; }

# Giữ lại Navigation routes
-keep class com.iotparking.app.navigation.** { *; }
