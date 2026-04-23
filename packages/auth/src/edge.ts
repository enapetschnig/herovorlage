import NextAuth from "next-auth";
import { authConfigEdge } from "./config.edge";

export const { auth } = NextAuth(authConfigEdge);
