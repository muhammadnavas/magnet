import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import colors from "../../constants/colors";
import Card from "../ui/Card";
import Tag from "../ui/Tag";

export const ProjectCard = ({ project }) => {
  const { id, name, description, technologies, documentCount = 0, lastActivity } = project;

  const handlePress = () => {
    router.push(`/projects/${id}`);
  };

  return (
    <Card onPress={handlePress} className="p-4 mb-4">
      {/* Title & Icon */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 items-center justify-center mr-2.5">
            <Ionicons name="folder" size={16} color={colors.primaryLight} />
          </View>
          <Text className="text-white text-base font-bold">
            {name}
          </Text>
        </View>
        
        <View className="flex-row items-center bg-surface-hover px-2 py-1 rounded-md border border-border/40">
          <Ionicons name="document-attach" size={10} color={colors.text.secondary} className="mr-1" />
          <Text className="text-text-secondary text-[9px] font-bold">
            {documentCount} items
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text className="text-text-secondary text-xs leading-relaxed mb-3" numberOfLines={2}>
        {description}
      </Text>

      {/* Footer: Technologies */}
      {technologies && technologies.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 pt-2 border-t border-border/40">
          {technologies.slice(0, 3).map((tech, index) => (
            <Tag key={`${tech}-${index}`} text={tech} variant="accent" />
          ))}
          {technologies.length > 3 && (
            <Text className="text-text-muted text-[10px] font-bold tracking-wider self-center ml-1">
              +{technologies.length - 3} MORE
            </Text>
          )}
        </View>
      )}
    </Card>
  );
};

export default ProjectCard;
