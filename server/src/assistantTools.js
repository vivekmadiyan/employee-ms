import { z } from 'zod';

export const statusUpdateSchema = z.object({
  status: z.enum(['active', 'completed', 'failed']),
  expectedStatus: z.enum(['new', 'active']).optional()
});

export const canChangeTaskStatus = (from, to) =>
  (from === 'new' && to === 'active') || (from === 'active' && ['completed', 'failed'].includes(to));

const statusLabels = { new: 'New', active: 'In progress', completed: 'Completed', failed: 'Needs attention' };
const statusProposal = statusUpdateSchema.pick({ status: true }).extend({
  taskId: z.number().int().positive()
}).strict();

const tools = [
  {
    id: 'set_task_status',
    label: 'Update task status',
    description: 'Start a new task or mark an in-progress task as completed or needing attention.',
    example: 'Mark the inventory review as completed.',
    roles: ['admin', 'employee'],
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'integer', description: 'ID of the matching visible task. Ask which one if multiple tasks match.' },
        status: { type: 'string', enum: ['active', 'completed', 'failed'], description: 'New tasks can only move to active. Only active tasks can move to completed or failed.' }
      },
      required: ['taskId', 'status'],
      additionalProperties: false
    },
    prepare(args, { tasks }) {
      const parsed = statusProposal.safeParse(args);
      if (!parsed.success) return null;
      const { taskId, status } = parsed.data;
      const task = tasks.find(item => item.id === taskId);
      if (!task || !canChangeTaskStatus(task.status, status)) return null;

      return {
        title: 'Update task status',
        details: [
          { label: 'Task', value: task.title },
          { label: 'Current status', value: statusLabels[task.status] },
          { label: 'New status', value: statusLabels[status] }
        ],
        input: { taskId, status, expectedStatus: task.status }
      };
    }
  },
  {
    id: 'create_task',
    label: 'Create a task',
    description: 'Draft a task for an active teammate. Ask for the assignee and due date if they are missing or ambiguous.',
    example: 'Create an inventory review for Sam due on Friday.',
    roles: ['admin'],
    parameters: {
      type: 'object',
      properties: {
        taskTitle: { type: 'string', description: 'Short title for the new task.' },
        taskDescription: { type: 'string', description: 'Description drafted from the user’s instructions.' },
        taskDate: { type: 'string', description: 'Requested due date in YYYY-MM-DD format.' },
        category: { type: 'string', description: 'Task category. Use General if the user did not specify one.' },
        assignedTo: { type: 'integer', description: 'ID of the explicitly selected teammate in the active assignee list.' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Use medium if the user did not specify a priority.' }
      },
      required: ['taskTitle', 'taskDescription', 'taskDate', 'category', 'assignedTo', 'priority'],
      additionalProperties: false
    },
    prepare(args, { assignees, taskSchema }) {
      const parsed = taskSchema.strict().safeParse(args);
      if (!parsed.success) return null;
      const input = parsed.data;
      const assignee = assignees.find(item => item.id === input.assignedTo);
      if (!assignee) return null;

      return {
        title: 'Create a task',
        details: [
          { label: 'Task', value: input.taskTitle },
          { label: 'Description', value: input.taskDescription },
          { label: 'Assignee', value: `${assignee.name} (#${assignee.id})` },
          { label: 'Due date', value: input.taskDate },
          { label: 'Category', value: input.category },
          { label: 'Priority', value: input.priority }
        ],
        input
      };
    }
  }
];

export const toolsForRole = role => tools.filter(tool => tool.roles.includes(role));

export function prepareAssistantAction(call, selectedTools, context) {
  const tool = selectedTools.find(tool => tool.id === call?.name);
  if (!tool) return null;
  const proposal = tool.prepare(call.args, context);
  return proposal ? { tool: tool.id, ...proposal } : null;
}
