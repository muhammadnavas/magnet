import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useAuth } from "../../hooks/useAuth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const { login, isLoggingIn, loginError } = useAuth();

  const handleLogin = () => {
    setFormError("");
    if (!email || !password) {
      setFormError("Please enter both email and password.");
      return;
    }
    
    // Trigger mutation
    login({ email, password });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 py-12 justify-center">
        {/* Brand Header */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 items-center justify-center mb-4">
            <Ionicons name="sparkles" size={32} color={colors.primary} />
          </View>
          <Text className="text-white text-2xl font-black tracking-tight mb-1">
            ORIO
          </Text>
          <Text className="text-text-secondary text-sm font-medium">
            Private AI Knowledge Repository
          </Text>
        </View>

        {/* Form Container */}
        <View className="mb-6">
          <Input
            label="EMAIL ADDRESS"
            placeholder="developer@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setFormError("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            iconLeft={<Ionicons name="mail-outline" size={18} color={colors.text.muted} />}
          />

          <Input
            label="PASSWORD"
            placeholder="••••••••"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setFormError("");
            }}
            secureTextEntry
            autoCapitalize="none"
            iconLeft={<Ionicons name="lock-closed-outline" size={18} color={colors.text.muted} />}
          />
        </View>

        {/* Error banner */}
        {(formError || loginError) && (
          <View className="bg-error/10 border border-error/20 rounded-xl p-3 mb-6">
            <Text className="text-error text-xs font-semibold text-center">
              {formError || loginError?.message || "Login failed. Please verify credentials."}
            </Text>
          </View>
        )}

        {/* Action button */}
        <Button
          loading={isLoggingIn}
          onPress={handleLogin}
          className="mb-6 shadow-lg shadow-primary/20"
        >
          Sign In
        </Button>

        {/* Divider */}
        <View className="flex-row items-center mb-6">
          <View className="flex-1 h-[1px] bg-border" />
          <Text className="text-text-muted text-xs mx-4 uppercase font-bold tracking-widest">
            or
          </Text>
          <View className="flex-1 h-[1px] bg-border" />
        </View>

        {/* Google Authentication Button UI */}
        <Button
          variant="secondary"
          iconLeft={<Ionicons name="logo-google" size={16} color={colors.text.primary} />}
          onPress={() => alert("Google SSO is coming soon!")}
          className="mb-8"
        >
          Continue with Google
        </Button>

        {/* Signup Footer Link */}
        <View className="flex-row justify-center items-center">
          <Text className="text-text-secondary text-xs font-semibold">
            Don't have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.push("/signup")}>
            <Text className="text-primary-light text-xs font-bold">
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
