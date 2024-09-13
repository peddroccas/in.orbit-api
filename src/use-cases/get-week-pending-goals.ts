import dayjs from "dayjs";
import weekOfYear from 'dayjs/plugin/weekOfYear'
import { db } from '../db'
import { goalCompletions, goals } from "../db/schema";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";

dayjs.extend(weekOfYear)

export async function getWeekPendingGoals() {
    const firstDayOfWeek = dayjs().startOf('week').toDate()
    const lastDayOfWeek = dayjs().endOf('week').toDate()

    const goalsCreatedUpToWeek = db.$with('goal_created_up_to_week').as(
        db
            .select({
                id: goals.id,
                title: goals.title,
                desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
                createdAt: goals.createdAt
            })
            .from(goals)
            .where(lte(goals.createdAt, lastDayOfWeek))
    )

    const goalsCompletionsCounts = db.$with('goal_completions_counts').as(
        db
            .select({
                goalId: goalCompletions.goalId,
                completionCount: count(goalCompletions.id).as('completionCount')

            })
            .from(goalCompletions)
            .where(and(
                gte(goalCompletions.createdAt, firstDayOfWeek),
                lte(goalCompletions.createdAt, lastDayOfWeek)
            ))
            .groupBy(goalCompletions.goalId)
    )

    const pendingGoals = await db
        .with(goalsCompletionsCounts, goalsCreatedUpToWeek)
        .select({
            id: goalsCreatedUpToWeek.id,
            title: goalsCreatedUpToWeek.title,
            desiredWeeklyFrequency: goalsCreatedUpToWeek.desiredWeeklyFrequency,
            completionCount: sql/*sql*/`
            COALESCE(${goalsCompletionsCounts.completionCount}, 0)
            `.mapWith(Number)
        })
        .from(goalsCreatedUpToWeek)
        .leftJoin(goalsCompletionsCounts, eq(goalsCompletionsCounts.goalId, goalsCreatedUpToWeek.id))

    return {
        pendingGoals
    }
}