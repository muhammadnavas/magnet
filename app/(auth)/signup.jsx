import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useAuth } from "../../hooks/useAuth";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const { register, isRegistering, registerError } = useAuth();

  const handleSignup = () => {
    setFormError("");
    if (!name || !email || !password || !confirmPassword) {
      setFormError("All fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    // Trigger mutation
    register({ name, email, password });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 py-12 justify-center">
        {/* Header */}
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 items-center justify-center mb-4">
            <Ionicons name="person-add" size={28} color={colors.primary} />
          </View>
          <Text className="text-white text-2xl font-black tracking-tight mb-1">
            CREATE ACCOUNT
          </Text>
          <Text className="text-text-secondary text-sm font-medium">
            Join your private Orio repository
          </Text>
        </View>

        {/* Inputs */}
        <View className="mb-4">
          <Input
            label="FULL NAME"
            placeholder="Navas"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setFormError("");
            }}
            iconLeft={<Ionicons name="person-outline" size={18} color={colors.text.muted} />}
          />

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

          <Input
            label="CONFIRM PASSWORD"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setFormError("");
            }}
            secureTextEntry
            autoCapitalize="none"
            iconLeft={<Ionicons name="shield-checkmark-outline" size={18} color={colors.text.muted} />}
          />
        </View>

        {/* Form Error or Registration Error */}
        {(formError || registerError) && (
          <View className="bg-error/10 border border-error/20 rounded-xl p-3 mb-6">
            <Text className="text-error text-xs font-semibold text-center">
              {formError || registerError?.message || "Registration failed. Try a different email."}
            </Text>
          </View>
        )}

        {/* Register Action Button */}
        <Button
          loading={isRegistering}
          onPress={handleSignup}
          className="mb-8 shadow-lg shadow-primary/20"
        >
          Sign Up
        </Button>

        {/* Footer link to Login */}
        <View className="flex-row justify-center items-center">
          <Text className="text-text-secondary text-xs font-semibold">
            Already have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.replace("/login")}>
            <Text className="text-primary-light text-xs font-bold">
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
