import "reflect-metadata";
import "dotenv/config";
import { ApolloServer } from "apollo-server-express";
import { applyMiddleware } from "graphql-middleware";
import * as express from "express";
import * as session from "express-session";
import * as connectRedis from "connect-redis";
import * as cors from "cors";
import * as http from "http";

import { dbConnect } from "./utils/dbConnect";
import { createSchema } from "./utils/createSchema";
import { redis } from "./redis";

const RedisStore = connectRedis(session as any);

export const createServer = async () => {
  const apolloServer = new ApolloServer({
    subscriptions: {
      path: "/"
    },
    schema: createSchema() as any,
    context: ({ req, res }: any) => ({
      redis,
      session: req ? req.session : undefined,
      url: req ? req.protocol + "://" + req.get("host") : "",
      req,
      res
    })
  });

  const app = express();

  app.use(
    session({
      store: new RedisStore({
        client: redis as any,
        prefix: "sess:"
      }),
      name: "qid",
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        // secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7
      }
    } as any)
  );

  app.use(
    cors({
      credentials: true,
      origin:
        process.env.NODE_ENV === "development"
          ? "*"
          : (process.env.FRONTEND_HOST as string)
    })
  );

  await dbConnect();

  apolloServer.applyMiddleware({
    app,
    cors: false,
    path: "/"
  });

  const port = process.env.SERVER_PORT;
  const httpServer = http.createServer(app);
  apolloServer.installSubscriptionHandlers(httpServer);

  httpServer.listen(port, () => {
    console.log(
      `🚀 Server ready at http://localhost:${port}${apolloServer.graphqlPath}`
    );
    console.log(
      `🚀 Subscriptions ready at ws://localhost:${port}${
        apolloServer.subscriptionsPath
      }`
    );
  });

  return app;
};
