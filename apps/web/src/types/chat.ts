
import type { Timestamp } from "firebase/firestore"

// USER PROFILES

export interface ChatUser {
  id: string
  displayName: string
  email: string
  photoURL: string | null
  avatarPath?: string | null
  bio?: string
  createdAt: Timestamp
}

// CONVERSATIONS

export type ConversationType = "direct" | "group"

export interface Conversation {
  id: string
  type: ConversationType
  name: string | null
  photoURL: string | null
  avatarPath?: string | null
  participants: string[]
  admins: string[]
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// FILE ATTACHMENTS

export interface ChatAttachment {
  name: string
  storagePath: string
  contentType: string
  size: number
}

// MESSAGES

export type MessageType =
  | "text"
  | "image"
  | "gif"
  | "sticker"
  | "video"
  | "file"

export interface ChatMessage {
  id: string
  senderId: string
  type: MessageType
  text: string
  attachment?: ChatAttachment
  replyTo?: string | null
  createdAt: Timestamp
}

// REACTIONS

export interface MessageReaction {
  userId: string
  emoji: string
  createdAt: Timestamp
}

// GROUP POLLS

export interface ChatPoll {
  id: string
  question: string
  options: string[]
  createdBy: string
  createdAt: Timestamp
  closesAt?: Timestamp | null
}

// MEME BATTLES

export interface MemeBattle {
  id: string
  title: string
  createdBy: string
  status: "open" | "closed"
  createdAt: Timestamp
  endsAt: Timestamp
}
