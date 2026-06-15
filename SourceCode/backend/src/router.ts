import type { WsMessage, RequestPayloads, ResponsePayloads } from './shared/messages.js';
import { isWsMessage } from './shared/messages.js';
import type { AgentSession } from './session/AgentSession.js';
import { SldAgentError } from './errors.js';
import type { ValidationError } from './shared/types.js';

export function createRouter() {
  async function handle(raw: string, session: AgentSession): Promise<WsMessage> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return errorResponse('unknown', 'INVALID_REQUEST', 'Malformed JSON');
    }

    if (!isWsMessage(parsed)) {
      return errorResponse('unknown', 'INVALID_REQUEST', 'Invalid message envelope');
    }

    const { type, requestId, payload } = parsed;

    try {
      switch (type) {
        case 'generate': {
          const result = await session.generate(payload as RequestPayloads['generate']);
          return { type: 'generation_result', requestId, payload: result };
        }
        case 'modify': {
          const result = await session.modify(payload as RequestPayloads['modify']);
          return { type: 'generation_result', requestId, payload: result };
        }
        case 'apply_patch': {
          const result = await session.applyPatch(payload as RequestPayloads['apply_patch']);
          return { type: 'generation_result', requestId, payload: result };
        }
        case 'import_style': {
          const result = await session.importStyle(payload as RequestPayloads['import_style']);
          return { type: 'generation_result', requestId, payload: result };
        }
        case 'export': {
          const result = await session.export(payload as RequestPayloads['export']);
          return { type: 'export_result', requestId, payload: result };
        }
        case 'validate': {
          const validation = await session.validate((payload as RequestPayloads['validate']).style);
          return {
            type: 'validation_result',
            requestId,
            payload: { style: session.getState().currentStyle, validation },
          };
        }
        case 'get_domains': {
          const result = session.getDomains();
          return { type: 'domains_result', requestId, payload: result };
        }
        case 'set_domain': {
          await session.setDomain((payload as RequestPayloads['set_domain']).domain);
          return { type: 'domains_result', requestId, payload: session.getDomains() };
        }
        case 'set_data_schema': {
          session.setDataSchema((payload as RequestPayloads['set_data_schema']).dataSchema);
          return { type: 'ok', requestId, payload: { ok: true } };
        }
        case 'ping':
          return { type: 'pong', requestId, payload: { timestamp: Date.now() } };
        default:
          return errorResponse(requestId, 'INVALID_REQUEST', `Unknown message type: ${type}`);
      }
    } catch (err) {
      if (err instanceof SldAgentError) {
        return errorResponse(requestId, err.code, err.message, {
          busy: err.details.busy,
          details: err.details.details as ValidationError[] | undefined,
        });
      }
      return errorResponse(requestId, 'INTERNAL_ERROR', String(err));
    }
  }

  return { handle };
}

function errorResponse(
  requestId: string,
  code: ResponsePayloads['error']['code'],
  message: string,
  details?: { busy?: boolean; details?: ValidationError[] }
): WsMessage {
  const payload: ResponsePayloads['error'] = { requestId, code, message };
  if (details?.busy) payload.busy = true;
  if (details?.details) payload.details = details.details;
  return { type: 'error', requestId, payload };
}
