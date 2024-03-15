import dayjs from "dayjs";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "./prisma";

export async function appRoutes(app: FastifyInstance) {
  app.post("/goals", async (request) => {
    const createGoalBody = z.object({
      title: z.string(),
      weekDays: z.array(z.number().min(0).max(6)),
    });

    const { title, weekDays } = createGoalBody.parse(request.body);

    const today = dayjs().startOf("day").toDate();

    await prisma.goal.create({
      data: {
        title,
        created_at: today,
        weekDays: {
          create: weekDays.map((weekDay) => {
            return {
              week_day: weekDay,
            };
          }),
        },
      },
    });
  });

  app.get("/day", async (request) => {
    const getDayParams = z.object({
      date: z.coerce.date(),
    });

    const { date } = getDayParams.parse(request.query);

    const parsedData = dayjs(date).startOf("day");
    const weekDay = parsedData.get("day");

    const possibleGoals = await prisma.goal.findMany({
      where: {
        created_at: {
          lte: date,
        },
        weekDays: {
          some: {
            week_day: weekDay,
          },
        },
      },
    });

    const day = await prisma.day.findFirst({
      where: {
        date: { gte: parsedData.toDate() },
      },
      include: {
        dayGoals: true,
      },
    });

    const completedGoals =
      day?.dayGoals.map((dayGoal) => {
        return dayGoal.goal_id;
      }) ?? [];

    return {
      possibleGoals,
      completedGoals,
    };
  });

  app.patch("/goals/:id/toggle", async (request) => {
    const toggleGoalsParams = z.object({
      id: z.string().uuid(),
    });

    const { id } = toggleGoalsParams.parse(request.params);

    const today = dayjs().startOf("day").toDate();

    let day = await prisma.day.findUnique({
      where: {
        date: today,
      },
    });

    if (!day) {
      day = await prisma.day.create({
        data: {
          date: today,
        },
      });
    }

    const dayGoal = await prisma.dayGoal.findUnique({
      where: {
        day_id_goal_id: {
          day_id: day.id,
          goal_id: id,
        },
      },
    });

    if (dayGoal) {
      await prisma.dayGoal.delete({
        where: {
          id: dayGoal.id,
        },
      });
    } else {
      await prisma.dayGoal.create({
        data: {
          day_id: day.id,
          goal_id: id,
        },
      });
    }
  });

  app.get("/summary", async (request) => {
    const summary = await prisma.$queryRaw`
      SELECT 
        D.id , 
        D.date, 
        (
          SELECT 
            cast(count(*) as float)
            FROM day_goals DG
            WHERE DG.day_id = D.id
        ) as completed,
        (
          SELECT
          cast(count(*) as float)
          FROM goal_week_days GWD
          JOIN goals G
            ON G.id = GWD.goal_id
          WHERE 
            GWD.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int )
            AND G.created_at <= D.date
        ) as amount
      FROM days D
    `;
    return summary;
  });
}