import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import { useAppTheme } from "../../store/themeStore";

export default function TypingIndicator() {
  const { themeColors } = useAppTheme();
  
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = (anim, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            delay: delay,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    createAnimation(anim1, 0).start();
    createAnimation(anim2, 200).start();
    createAnimation(anim3, 400).start();
  }, [anim1, anim2, anim3]);

  const getAnimatedStyle = (anim) => ({
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -4],
        }),
      },
    ],
  });

  return (
    <View 
      style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }} 
      className="flex-row items-center mb-4 self-start border rounded-2xl px-4 py-3 ml-2"
    >
      <Animated.View 
        style={[
          { width: 7, height: 7, borderRadius: 4, backgroundColor: themeColors.text.muted, marginRight: 4 },
          getAnimatedStyle(anim1)
        ]} 
      />
      <Animated.View 
        style={[
          { width: 7, height: 7, borderRadius: 4, backgroundColor: themeColors.text.muted, marginRight: 4 },
          getAnimatedStyle(anim2)
        ]} 
      />
      <Animated.View 
        style={[
          { width: 7, height: 7, borderRadius: 4, backgroundColor: themeColors.text.muted },
          getAnimatedStyle(anim3)
        ]} 
      />
    </View>
  );
}
