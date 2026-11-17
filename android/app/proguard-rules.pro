# Proguard rules for Tedbeera Egypt
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class com.tedbeera.egypt.data.model.** { *; }
-keep class com.tedbeera.egypt.data.local.entity.** { *; }
-keep class androidx.room.** { *; }

# Protect Capacitor bridge plugins and annotated plugin methods from R8 stripping/renaming
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class com.tedbeera.egypt.**Plugin { *; }
-keep class com.getcapacitor.community.admob.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
}

