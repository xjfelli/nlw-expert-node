import { FastifyInstance } from "fastify";
import z from "zod";
import { randomUUID } from "crypto";
import { prisma } from "../../lib/prisma";

export async function voteOnPoll(app: FastifyInstance) {
  app.post("/polls/:pollId/votes", async (request, reply) => {
    const votePollBody = z.object({
      pollOptionId: z.string().uuid(),
    });

    const votePollParams = z.object({
      pollId: z.string().uuid(),
    });

    const { pollId } = votePollParams.parse(request.params);
    const { pollOptionId } = votePollBody.parse(request.body);

    let sessionId = request.cookies.sessionId;

    if (sessionId) {
      const userPreviousVoteOnPoll = await prisma.vote.findUnique({
        where: {
          sessionId_pollId: {
            pollId,
            sessionId,
          },
        },
      });

      if (
        userPreviousVoteOnPoll &&
        userPreviousVoteOnPoll.pollOptionId !== pollOptionId
      ) {
        await prisma.vote.delete({
          where: {
            id: userPreviousVoteOnPoll.id,
          },
        });
      } else if (userPreviousVoteOnPoll) {
        return reply
          .status(400)
          .send({ error: "User already voted on this poll" });
      }
    }

    if (!sessionId) {
      sessionId = randomUUID();

      reply.setCookie("sessionId", sessionId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        signed: true,
        httpOnly: true,
      });
    }

    await prisma.vote.create({
      data: {
        sessionId,
        pollId,
        pollOptionId,
      },
    });

    return reply.status(201).send();
  });
}
