# MindSync System Context

> **Purpose:** Reference document for the AI Coach and development team

---

## Overview

MindSync is a therapeutic framework designed to help people understand how their brain works under ideal conditions. It provides insights and tools to address anxiety, depression, and overall confidence by exploring the impact of childhood experiences and offering hope for change.

---

## Core Concepts

### Child Brain vs Adult Brain

The brain operates with two modes:
- **Child Brain**: Seeks stimulation, fun, and rest. Needs to be nurtured and allowed recovery time.
- **Adult Brain**: Focused on productivity, responsibility, and long-term consequences. Can override the child brain's needs, leading to burnout.

---

## The 6th Sense: Intuition/Feelings

- Experience builds intuition over time
- Like a mechanic with 20 years of experience who can diagnose issues by sound alone
- Pattern recognition from personal history guides "gut feelings"
- The more experience, the less effort needed to achieve accurate results
- **Intuition = recognizing patterns and making assumptions based on personal history**

---

## Breaking Down "Fun"

Fun has **measurable criteria**:

| Component | Description |
|-----------|-------------|
| **Goal** | The overall intent or objective of the activity |
| **Skill** | Abilities required to participate (can improve over time) |
| **Challenge** | Difficulties like losing or concepts being hard to grasp |
| **No Long-Term Consequences** | Won't impact productivity or quality of life if goal isn't achieved |
| **Dopamine/Serotonin** | Provides reward hormones, increasing positive feelings |

### Fun vs Enjoyable

When **long-term consequences** are added to fun, it becomes **"Enjoyable"**:
- Still has goal, skill, challenge, and reward hormones
- BUT outcomes now matter
- **Enjoyable activities still cause emotional and energy drainage**

**Example**: Making music in your garage for fun → Getting a record deal → Now it's enjoyable (not fun) because outcomes matter.

This is why musicians have side projects—to maintain fun without inhibiting independence, future, or peer reception.

---

## Vegetative Recovery

A tool/behavior for addressing **dissociation**:

- Like when a child has an overstimulating day and finds a spot to rest
- The body seeks recovery through "doing nothing" (lying down, scrolling mindlessly, watching TV)
- **The Problem**: The adult brain criticizes this rest (calling it lazy, too sensitive, a waste of time)
- **The Solution**: Give the body **permission to rest and do nothing**
- Allows the body to recover and move forward, alleviating dissociation

---

## Parenting Skill: "How Can I Earn It?"

A framework for teaching children the productivity → reward cycle:

| Instead of... | Try... |
|---------------|--------|
| Child: "I want..." | Child: "How can I earn...?" |
| Parent becomes barrier to pleasure | Child becomes their own barrier |
| Parent says "No" | Parent offers a path: "If you clean your room, you can go outside" |

**Benefits**:
- Child learns productivity leads to fun
- Child explores their own limits and desires
- Experience guides behavior (child cleans room in anticipation of reward)
- Better communication outcomes between parents and children

---

## The Three Phases of MindSync

### Phase 1: Self-Value
**Focus**: Build insight and value of self, **outside the influence of social supports**

- Develop independence
- Envision a healthy future
- Find comfort in current potential
- Explore passions, hobbies, and interests
- **Goal**: Develop one's own value without the influence of others

---

## Phase 2: Social Reconnection
**Focus**: Reconnect with social supports and relationships

- Learn assertive communication
- Establish boundaries
- Practice de-escalation
- **Goal**: Improve communication outcomes with people who once felt draining

---

## Phase 3: Mastery
**Focus**: Apply Phase 1 and 2 in larger settings

- Engage in family events, work events, and social gatherings
- Maintain confidence regardless of environment
- **Goal**: Leave interactions without being emotionally impacted or mentally drained

---

## Summary

MindSync is a tool that:
- Helps people understand how the brain works under ideal conditions
- Shows the impact of childhood trauma while offering hope for change
- Breaks down complex concepts into manageable, relatable pieces
- Provides specific insights and tools for anxiety, depression, and confidence

---

## App Design Implications

When building the MindSync App, features should:

1. **Support Phase Progression** - Guide users through Phase 1 → 2 → 3
2. **Distinguish Fun vs Enjoyable** - Help users identify activities that truly recharge vs drain
3. **Encourage Vegetative Recovery** - Normalize rest without guilt
4. **Track Intuition Development** - Help users recognize patterns in their feelings
5. **Support Independence First** - Phase 1 focuses on self before social connections
6. **Provide Permission** - The app should give users "permission" to rest, feel, and recover

---

## Current Implementation Notes

- **Data storage:** browser-local `localStorage` only; no cloud sync, no accounts
- **AI Coach:** provider-agnostic; uses StepFun StepPlan API when a key is configured in Settings, otherwise falls back to offline Smart Logic
- **Task model:** tasks are typed as ADULT, CHILD, or REST
- **Scheduling:** supports natural-language dates/times and explicit `YYYY-MM-DD` dates
- **Goals:** users can create goals, break them into starter tasks with AI, and track completion
- **Architecture:** Next.js 16 App Router + TypeScript + Tailwind + Zustand + `db.ts` persistence layer

---

*Reference this document for accurate context about the MindSync framework.*
