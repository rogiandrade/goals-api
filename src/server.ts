import fastify from "fastify";
import cors from "@fastify/cors"
import { appRoutes } from "./lib/route";

const app = fastify();

app.register(cors)
app.register(appRoutes)

app
  .listen({
    port: 3000,
    host: "0.0.0.0",
  })
  .then(() => {
    console.log("Server listening on 3000");
  });
