import * as utils from '@interactjs/utils';
import PointerEvent from './PointerEvent';
const signals = new utils.Signals();
const simpleSignals = ['down', 'up', 'cancel'];
const simpleEvents = ['down', 'up', 'cancel'];
const defaults = {
    holdDuration: 600,
    ignoreFrom: null,
    allowFrom: null,
    origin: { x: 0, y: 0 },
};
const pointerEvents = {
    id: 'pointer-events/base',
    install,
    signals,
    PointerEvent,
    fire,
    collectEventTargets,
    createSignalListener,
    defaults,
    types: [
        'down',
        'move',
        'up',
        'cancel',
        'tap',
        'doubletap',
        'hold',
    ],
};
function fire(arg, scope) {
    const { interaction, pointer, event, eventTarget, type = arg.pointerEvent.type, targets = collectEventTargets(arg), } = arg;
    const { pointerEvent = new PointerEvent(type, pointer, event, eventTarget, interaction, scope.now()), } = arg;
    const signalArg = {
        interaction,
        pointer,
        event,
        eventTarget,
        targets,
        type,
        pointerEvent,
    };
    for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        for (const prop in target.props || {}) {
            pointerEvent[prop] = target.props[prop];
        }
        const origin = utils.getOriginXY(target.eventable, target.element);
        pointerEvent.subtractOrigin(origin);
        pointerEvent.eventable = target.eventable;
        pointerEvent.currentTarget = target.element;
        target.eventable.fire(pointerEvent);
        pointerEvent.addOrigin(origin);
        if (pointerEvent.immediatePropagationStopped ||
            (pointerEvent.propagationStopped &&
                (i + 1) < targets.length && targets[i + 1].element !== pointerEvent.currentTarget)) {
            break;
        }
    }
    signals.fire('fired', signalArg);
    if (type === 'tap') {
        // if pointerEvent should make a double tap, create and fire a doubletap
        // PointerEvent and use that as the prevTap
        const prevTap = pointerEvent.double
            ? fire({
                interaction,
                pointer,
                event,
                eventTarget,
                type: 'doubletap',
            }, scope)
            : pointerEvent;
        interaction.prevTap = prevTap;
        interaction.tapTime = prevTap.timeStamp;
    }
    return pointerEvent;
}
function collectEventTargets({ interaction, pointer, event, eventTarget, type }) {
    const pointerIndex = interaction.getPointerIndex(pointer);
    const pointerInfo = interaction.pointers[pointerIndex];
    // do not fire a tap event if the pointer was moved before being lifted
    if (type === 'tap' && (interaction.pointerWasMoved ||
        // or if the pointerup target is different to the pointerdown target
        !(pointerInfo && pointerInfo.downTarget === eventTarget))) {
        return [];
    }
    const path = utils.dom.getPath(eventTarget);
    const signalArg = {
        interaction,
        pointer,
        event,
        eventTarget,
        type,
        path,
        targets: [],
        element: null,
    };
    for (const element of path) {
        signalArg.element = element;
        signals.fire('collect-targets', signalArg);
    }
    if (type === 'hold') {
        signalArg.targets = signalArg.targets.filter((target) => target.eventable.options.holdDuration === interaction.pointers[pointerIndex].hold.duration);
    }
    return signalArg.targets;
}
function install(scope) {
    const { interactions, } = scope;
    scope.pointerEvents = pointerEvents;
    scope.defaults.actions.pointerEvents = pointerEvents.defaults;
    interactions.signals.on('new', ({ interaction }) => {
        interaction.prevTap = null; // the most recent tap event on this interaction
        interaction.tapTime = 0; // time of the most recent tap event
    });
    interactions.signals.on('update-pointer', ({ down, pointerInfo }) => {
        if (!down && pointerInfo.hold) {
            return;
        }
        pointerInfo.hold = { duration: Infinity, timeout: null };
    });
    interactions.signals.on('move', ({ interaction, pointer, event, eventTarget, duplicateMove }) => {
        const pointerIndex = interaction.getPointerIndex(pointer);
        if (!duplicateMove && (!interaction.pointerIsDown || interaction.pointerWasMoved)) {
            if (interaction.pointerIsDown) {
                clearTimeout(interaction.pointers[pointerIndex].hold.timeout);
            }
            fire({
                interaction,
                pointer,
                event,
                eventTarget,
                type: 'move',
            }, scope);
        }
    });
    interactions.signals.on('down', ({ interaction, pointer, event, eventTarget, pointerIndex }) => {
        const timer = interaction.pointers[pointerIndex].hold;
        const path = utils.dom.getPath(eventTarget);
        const signalArg = {
            interaction,
            pointer,
            event,
            eventTarget,
            type: 'hold',
            targets: [],
            path,
            element: null,
        };
        for (const element of path) {
            signalArg.element = element;
            signals.fire('collect-targets', signalArg);
        }
        if (!signalArg.targets.length) {
            return;
        }
        let minDuration = Infinity;
        for (const target of signalArg.targets) {
            const holdDuration = target.eventable.options.holdDuration;
            if (holdDuration < minDuration) {
                minDuration = holdDuration;
            }
        }
        timer.duration = minDuration;
        timer.timeout = setTimeout(() => {
            fire({
                interaction,
                eventTarget,
                pointer,
                event,
                type: 'hold',
            }, scope);
        }, minDuration);
    });
    for (const signalName of ['up', 'cancel']) {
        interactions.signals.on(signalName, ({ interaction, pointerIndex }) => {
            if (interaction.pointers[pointerIndex].hold) {
                clearTimeout(interaction.pointers[pointerIndex].hold.timeout);
            }
        });
    }
    for (let i = 0; i < simpleSignals.length; i++) {
        interactions.signals.on(simpleSignals[i], createSignalListener(simpleEvents[i], scope));
    }
    interactions.signals.on('up', ({ interaction, pointer, event, eventTarget }) => {
        if (!interaction.pointerWasMoved) {
            fire({ interaction, eventTarget, pointer, event, type: 'tap' }, scope);
        }
    });
}
function createSignalListener(type, scope) {
    return function ({ interaction, pointer, event, eventTarget }) {
        fire({ interaction, eventTarget, pointer, event, type }, scope);
    };
}
export default pointerEvents;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJhc2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBSUEsT0FBTyxLQUFLLEtBQUssTUFBTSxtQkFBbUIsQ0FBQTtBQUMxQyxPQUFPLFlBQVksTUFBTSxnQkFBZ0IsQ0FBQTtBQTRDekMsTUFBTSxPQUFPLEdBQVMsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUE7QUFDekMsTUFBTSxhQUFhLEdBQUcsQ0FBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBRSxDQUFBO0FBQ2hELE1BQU0sWUFBWSxHQUFJLENBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUUsQ0FBQTtBQUVoRCxNQUFNLFFBQVEsR0FBd0I7SUFDcEMsWUFBWSxFQUFFLEdBQUc7SUFDakIsVUFBVSxFQUFJLElBQUk7SUFDbEIsU0FBUyxFQUFLLElBQUk7SUFDbEIsTUFBTSxFQUFRLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFO0NBQzdCLENBQUE7QUFFRCxNQUFNLGFBQWEsR0FBRztJQUNwQixFQUFFLEVBQUUscUJBQXFCO0lBQ3pCLE9BQU87SUFDUCxPQUFPO0lBQ1AsWUFBWTtJQUNaLElBQUk7SUFDSixtQkFBbUI7SUFDbkIsb0JBQW9CO0lBQ3BCLFFBQVE7SUFDUixLQUFLLEVBQUU7UUFDTCxNQUFNO1FBQ04sTUFBTTtRQUNOLElBQUk7UUFDSixRQUFRO1FBQ1IsS0FBSztRQUNMLFdBQVc7UUFDWCxNQUFNO0tBQ1A7Q0FDRixDQUFBO0FBRUQsU0FBUyxJQUFJLENBQW9CLEdBUWhDLEVBQUUsS0FBcUI7SUFDdEIsTUFBTSxFQUNKLFdBQVcsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFDeEMsSUFBSSxHQUFJLEdBQVcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUNyQyxPQUFPLEdBQUcsbUJBQW1CLENBQUMsR0FBRyxDQUFDLEdBQ25DLEdBQUcsR0FBRyxDQUFB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LEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQTtJQUNqRSxDQUFDLENBQUE7QUFDSCxDQUFDO0FBRUQsZUFBZSxhQUFhLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQZXJBY3Rpb25EZWZhdWx0cyB9IGZyb20gJ0BpbnRlcmFjdGpzL2NvcmUvZGVmYXVsdE9wdGlvbnMnXG5pbXBvcnQgRXZlbnRhYmxlIGZyb20gJ0BpbnRlcmFjdGpzL2NvcmUvRXZlbnRhYmxlJ1xuaW1wb3J0IEludGVyYWN0aW9uIGZyb20gJ0BpbnRlcmFjdGpzL2NvcmUvSW50ZXJhY3Rpb24nXG5pbXBvcnQgeyBTY29wZSB9IGZyb20gJ0BpbnRlcmFjdGpzL2NvcmUvc2NvcGUnXG5pbXBvcnQgKiBhcyB1dGlscyBmcm9tICdAaW50ZXJhY3Rqcy91dGlscydcbmltcG9ydCBQb2ludGVyRXZlbnQgZnJvbSAnLi9Qb2ludGVyRXZlbnQnXG5cbnR5cGUgRXZlbnRUYXJnZXRMaXN0ID0gQXJyYXk8e1xuICBldmVudGFibGU6IEV2ZW50YWJsZSxcbiAgZWxlbWVudDogSW50ZXJhY3QuRXZlbnRUYXJnZXQsXG4gIHByb3BzOiB7IFtrZXk6IHN0cmluZ106IGFueSB9LFxufT5cblxuZXhwb3J0IGludGVyZmFjZSBQb2ludGVyRXZlbnRPcHRpb25zIGV4dGVuZHMgUGVyQWN0aW9uRGVmYXVsdHMge1xuICBlbmFibGVkPzogdW5kZWZpbmVkIC8vIG5vdCB1c2VkXG4gIGhvbGREdXJhdGlvbj86IG51bWJlcixcbiAgaWdub3JlRnJvbT86IGFueSxcbiAgYWxsb3dGcm9tPzogYW55LFxuICBvcmlnaW4/OiBJbnRlcmFjdC5Qb2ludCB8IHN0cmluZyB8IEVsZW1lbnRcbn1cblxuZGVjbGFyZSBtb2R1bGUgJ0BpbnRlcmFjdGpzL2NvcmUvc2NvcGUnIHtcbiAgaW50ZXJmYWNlIFNjb3BlIHtcbiAgICBwb2ludGVyRXZlbnRzOiB0eXBlb2YgcG9pbnRlckV2ZW50c1xuICB9XG59XG5cbmRlY2xhcmUgbW9kdWxlICdAaW50ZXJhY3Rqcy9jb3JlL0ludGVyYWN0aW9uJyB7XG4gIGludGVyZmFjZSBJbnRlcmFjdGlvbiB7XG4gICAgcHJldlRhcD86IFBvaW50ZXJFdmVudDxzdHJpbmc+XG4gICAgdGFwVGltZT86IG51bWJlclxuICB9XG59XG5cbmRlY2xhcmUgbW9kdWxlICdAaW50ZXJhY3Rqcy9jb3JlL1BvaW50ZXJJbmZvJyB7XG4gIGludGVyZmFjZSBQb2ludGVySW5mbyB7XG4gICAgaG9sZD86IHtcbiAgICAgIGR1cmF0aW9uOiBudW1iZXJcbiAgICAgIHRpbWVvdXQ6IGFueVxuICAgIH1cbiAgfVxufVxuXG5kZWNsYXJlIG1vZHVsZSAnQGludGVyYWN0anMvY29yZS9kZWZhdWx0T3B0aW9ucycge1xuICBpbnRlcmZhY2UgQWN0aW9uRGVmYXVsdHMge1xuICAgIHBvaW50ZXJFdmVudHM6IEludGVyYWN0Lk9wdGlvbnNcbiAgfVxufVxuXG5jb25zdCBzaWduYWxzICAgICAgID0gbmV3IHV0aWxzLlNpZ25hbHMoKVxuY29uc3Qgc2ltcGxlU2lnbmFscyA9IFsgJ2Rvd24nLCAndXAnLCAnY2FuY2VsJyBdXG5jb25zdCBzaW1wbGVFdmVudHMgID0gWyAnZG93bicsICd1cCcsICdjYW5jZWwnIF1cblxuY29uc3QgZGVmYXVsdHM6IFBvaW50ZXJFdmVudE9wdGlvbnMgPSB7XG4gIGhvbGREdXJhdGlvbjogNjAwLFxuICBpZ25vcmVGcm9tICA6IG51bGwsXG4gIGFsbG93RnJvbSAgIDogbnVsbCxcbiAgb3JpZ2luICAgICAgOiB7IHg6IDAsIHk6IDAgfSxcbn1cblxuY29uc3QgcG9pbnRlckV2ZW50cyA9IHtcbiAgaWQ6ICdwb2ludGVyLWV2ZW50cy9iYXNlJyxcbiAgaW5zdGFsbCxcbiAgc2lnbmFscyxcbiAgUG9pbnRlckV2ZW50LFxuICBmaXJlLFxuICBjb2xsZWN0RXZlbnRUYXJnZXRzLFxuICBjcmVhdGVTaWduYWxMaXN0ZW5lcixcbiAgZGVmYXVsdHMsXG4gIHR5cGVzOiBbXG4gICAgJ2Rvd24nLFxuICAgICdtb3ZlJyxcbiAgICAndXAnLFxuICAgICdjYW5jZWwnLFxuICAgICd0YXAnLFxuICAgICdkb3VibGV0YXAnLFxuICAgICdob2xkJyxcbiAgXSxcbn1cblxuZnVuY3Rpb24gZmlyZTxUIGV4dGVuZHMgc3RyaW5nPiAoYXJnOiB7XG4gIGludGVyYWN0aW9uOiBJbnRlcmFjdGlvbixcbiAgcG9pbnRlcjogSW50ZXJhY3QuUG9pbnRlclR5cGUsXG4gIGV2ZW50OiBJbnRlcmFjdC5Qb2ludGVyRXZlbnRUeXBlLFxuICBldmVudFRhcmdldDogSW50ZXJhY3QuRXZlbnRUYXJnZXQsXG4gIHRhcmdldHM/OiBFdmVudFRhcmdldExpc3QsXG4gIHBvaW50ZXJFdmVudD86IFBvaW50ZXJFdmVudDxUPixcbiAgdHlwZTogVFxufSwgc2NvcGU6IEludGVyYWN0LlNjb3BlKSB7XG4gIGNvbnN0IHtcbiAgICBpbnRlcmFjdGlvbiwgcG9pbnRlciwgZXZlbnQsIGV2ZW50VGFyZ2V0LFxuICAgIHR5cGUgPSAoYXJnIGFzIGFueSkucG9pbnRlckV2ZW50LnR5cGUsXG4gICAgdGFyZ2V0cyA9IGNvbGxlY3RFdmVudFRhcmdldHMoYXJnKSxcbiAgfSA9IGFyZ1xuXG4gIGNvbnN0IHtcbiAgICBwb2ludGVyRXZlbnQgPSBuZXcgUG9pbnRlckV2ZW50KHR5cGUsIHBvaW50ZXIsIGV2ZW50LCBldmVudFRhcmdldCwgaW50ZXJhY3Rpb24sIHNjb3BlLm5vdygpKSxcbiAgfSA9IGFyZ1xuXG4gIGNvbnN0IHNpZ25hbEFyZyA9IHtcbiAgICBpbnRlcmFjdGlvbixcbiAgICBwb2ludGVyLFxuICAgIGV2ZW50LFxuICAgIGV2ZW50VGFyZ2V0LFxuICAgIHRhcmdldHMsXG4gICAgdHlwZSxcbiAgICBwb2ludGVyRXZlbnQsXG4gIH1cblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHRhcmdldHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCB0YXJnZXQgPSB0YXJnZXRzW2ldXG5cbiAgICBmb3IgKGNvbnN0IHByb3AgaW4gdGFyZ2V0LnByb3BzIHx8IHt9KSB7XG4gICAgICAocG9pbnRlckV2ZW50IGFzIGFueSlbcHJvcF0gPSB0YXJnZXQucHJvcHNbcHJvcF1cbiAgICB9XG5cbiAgICBjb25zdCBvcmlnaW4gPSB1dGlscy5nZXRPcmlnaW5YWSh0YXJnZXQuZXZlbnRhYmxlLCB0YXJnZXQuZWxlbWVudClcblxuICAgIHBvaW50ZXJFdmVudC5zdWJ0cmFjdE9yaWdpbihvcmlnaW4pXG4gICAgcG9pbnRlckV2ZW50LmV2ZW50YWJsZSA9IHRhcmdldC5ldmVudGFibGVcbiAgICBwb2ludGVyRXZlbnQuY3VycmVudFRhcmdldCA9IHRhcmdldC5lbGVtZW50XG5cbiAgICB0YXJnZXQuZXZlbnRhYmxlLmZpcmUocG9pbnRlckV2ZW50KVxuXG4gICAgcG9pbnRlckV2ZW50LmFkZE9yaWdpbihvcmlnaW4pXG5cbiAgICBpZiAocG9pbnRlckV2ZW50LmltbWVkaWF0ZVByb3BhZ2F0aW9uU3RvcHBlZCB8fFxuICAgICAgICAocG9pbnRlckV2ZW50LnByb3BhZ2F0aW9uU3RvcHBlZCAmJlxuICAgICAgICAgICAgKGkgKyAxKSA8IHRhcmdldHMubGVuZ3RoICYmIHRhcmdldHNbaSArIDFdLmVsZW1lbnQgIT09IHBvaW50ZXJFdmVudC5jdXJyZW50VGFyZ2V0KSkge1xuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBzaWduYWxzLmZpcmUoJ2ZpcmVkJywgc2lnbmFsQXJnKVxuXG4gIGlmICh0eXBlID09PSAndGFwJykge1xuICAgIC8vIGlmIHBvaW50ZXJFdmVudCBzaG91bGQgbWFrZSBhIGRvdWJsZSB0YXAsIGNyZWF0ZSBhbmQgZmlyZSBhIGRvdWJsZXRhcFxuICAgIC8vIFBvaW50ZXJFdmVudCBhbmQgdXNlIHRoYXQgYXMgdGhlIHByZXZUYXBcbiAgICBjb25zdCBwcmV2VGFwID0gcG9pbnRlckV2ZW50LmRvdWJsZVxuICAgICAgPyBmaXJlKHtcbiAgICAgICAgaW50ZXJhY3Rpb24sXG4gICAgICAgIHBvaW50ZXIsXG4gICAgICAgIGV2ZW50LFxuICAgICAgICBldmVudFRhcmdldCxcbiAgICAgICAgdHlwZTogJ2RvdWJsZXRhcCcsXG4gICAgICB9LCBzY29wZSlcbiAgICAgIDogcG9pbnRlckV2ZW50XG5cbiAgICBpbnRlcmFjdGlvbi5wcmV2VGFwID0gcHJldlRhcFxuICAgIGludGVyYWN0aW9uLnRhcFRpbWUgPSBwcmV2VGFwLnRpbWVTdGFtcFxuICB9XG5cbiAgcmV0dXJuIHBvaW50ZXJFdmVudFxufVxuXG5mdW5jdGlvbiBjb2xsZWN0RXZlbnRUYXJnZXRzPFQgZXh0ZW5kcyBzdHJpbmc+ICh7IGludGVyYWN0aW9uLCBwb2ludGVyLCBldmVudCwgZXZlbnRUYXJnZXQsIHR5cGUgfToge1xuICBpbnRlcmFjdGlvbjogSW50ZXJhY3Rpb24sXG4gIHBvaW50ZXI6IEludGVyYWN0LlBvaW50ZXJUeXBlLFxuICBldmVudDogSW50ZXJhY3QuUG9pbnRlckV2ZW50VHlwZSxcbiAgZXZlbnRUYXJnZXQ6IEludGVyYWN0LkV2ZW50VGFyZ2V0LFxuICB0eXBlOiBUXG59KSB7XG4gIGNvbnN0IHBvaW50ZXJJbmRleCA9IGludGVyYWN0aW9uLmdldFBvaW50ZXJJbmRleChwb2ludGVyKVxuICBjb25zdCBwb2ludGVySW5mbyA9IGludGVyYWN0aW9uLnBvaW50ZXJzW3BvaW50ZXJJbmRleF1cblxuICAvLyBkbyBub3QgZmlyZSBhIHRhcCBldmVudCBpZiB0aGUgcG9pbnRlciB3YXMgbW92ZWQgYmVmb3JlIGJlaW5nIGxpZnRlZFxuICBpZiAodHlwZSA9PT0gJ3RhcCcgJiYgKGludGVyYWN0aW9uLnBvaW50ZXJXYXNNb3ZlZCB8fFxuICAgICAgLy8gb3IgaWYgdGhlIHBvaW50ZXJ1cCB0YXJnZXQgaXMgZGlmZmVyZW50IHRvIHRoZSBwb2ludGVyZG93biB0YXJnZXRcbiAgICAgICEocG9pbnRlckluZm8gJiYgcG9pbnRlckluZm8uZG93blRhcmdldCA9PT0gZXZlbnRUYXJnZXQpKSkge1xuICAgIHJldHVybiBbXVxuICB9XG5cbiAgY29uc3QgcGF0aCA9IHV0aWxzLmRvbS5nZXRQYXRoKGV2ZW50VGFyZ2V0KVxuICBjb25zdCBzaWduYWxBcmcgPSB7XG4gICAgaW50ZXJhY3Rpb24sXG4gICAgcG9pbnRlcixcbiAgICBldmVudCxcbiAgICBldmVudFRhcmdldCxcbiAgICB0eXBlLFxuICAgIHBhdGgsXG4gICAgdGFyZ2V0czogW10gYXMgRXZlbnRUYXJnZXRMaXN0LFxuICAgIGVsZW1lbnQ6IG51bGwsXG4gIH1cblxuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgcGF0aCkge1xuICAgIHNpZ25hbEFyZy5lbGVtZW50ID0gZWxlbWVudFxuXG4gICAgc2lnbmFscy5maXJlKCdjb2xsZWN0LXRhcmdldHMnLCBzaWduYWxBcmcpXG4gIH1cblxuICBpZiAodHlwZSA9PT0gJ2hvbGQnKSB7XG4gICAgc2lnbmFsQXJnLnRhcmdldHMgPSBzaWduYWxBcmcudGFyZ2V0cy5maWx0ZXIoKHRhcmdldCkgPT5cbiAgICAgIHRhcmdldC5ldmVudGFibGUub3B0aW9ucy5ob2xkRHVyYXRpb24gPT09IGludGVyYWN0aW9uLnBvaW50ZXJzW3BvaW50ZXJJbmRleF0uaG9sZC5kdXJhdGlvbilcbiAgfVxuXG4gIHJldHVybiBzaWduYWxBcmcudGFyZ2V0c1xufVxuXG5mdW5jdGlvbiBpbnN0YWxsIChzY29wZTogU2NvcGUpIHtcbiAgY29uc3Qge1xuICAgIGludGVyYWN0aW9ucyxcbiAgfSA9IHNjb3BlXG5cbiAgc2NvcGUucG9pbnRlckV2ZW50cyA9IHBvaW50ZXJFdmVudHNcbiAgc2NvcGUuZGVmYXVsdHMuYWN0aW9ucy5wb2ludGVyRXZlbnRzID0gcG9pbnRlckV2ZW50cy5kZWZhdWx0c1xuXG4gIGludGVyYWN0aW9ucy5zaWduYWxzLm9uKCduZXcnLCAoeyBpbnRlcmFjdGlvbiB9KSA9PiB7XG4gICAgaW50ZXJhY3Rpb24ucHJldlRhcCAgICA9IG51bGwgIC8vIHRoZSBtb3N0IHJlY2VudCB0YXAgZXZlbnQgb24gdGhpcyBpbnRlcmFjdGlvblxuICAgIGludGVyYWN0aW9uLnRhcFRpbWUgICAgPSAwICAgICAvLyB0aW1lIG9mIHRoZSBtb3N0IHJlY2VudCB0YXAgZXZlbnRcbiAgfSlcblxuICBpbnRlcmFjdGlvbnMuc2lnbmFscy5vbigndXBkYXRlLXBvaW50ZXInLCAoeyBkb3duLCBwb2ludGVySW5mbyB9KSA9PiB7XG4gICAgaWYgKCFkb3duICYmIHBvaW50ZXJJbmZvLmhvbGQpIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHBvaW50ZXJJbmZvLmhvbGQgPSB7IGR1cmF0aW9uOiBJbmZpbml0eSwgdGltZW91dDogbnVsbCB9XG4gIH0pXG5cbiAgaW50ZXJhY3Rpb25zLnNpZ25hbHMub24oJ21vdmUnLCAoeyBpbnRlcmFjdGlvbiwgcG9pbnRlciwgZXZlbnQsIGV2ZW50VGFyZ2V0LCBkdXBsaWNhdGVNb3ZlIH0pID0+IHtcbiAgICBjb25zdCBwb2ludGVySW5kZXggPSBpbnRlcmFjdGlvbi5nZXRQb2ludGVySW5kZXgocG9pbnRlcilcblxuICAgIGlmICghZHVwbGljYXRlTW92ZSAmJiAoIWludGVyYWN0aW9uLnBvaW50ZXJJc0Rvd24gfHwgaW50ZXJhY3Rpb24ucG9pbnRlcldhc01vdmVkKSkge1xuICAgICAgaWYgKGludGVyYWN0aW9uLnBvaW50ZXJJc0Rvd24pIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KGludGVyYWN0aW9uLnBvaW50ZXJzW3BvaW50ZXJJbmRleF0uaG9sZC50aW1lb3V0KVxuICAgICAgfVxuXG4gICAgICBmaXJlKHtcbiAgICAgICAgaW50ZXJhY3Rpb24sXG4gICAgICAgIHBvaW50ZXIsXG4gICAgICAgIGV2ZW50LFxuICAgICAgICBldmVudFRhcmdldCxcbiAgICAgICAgdHlwZTogJ21vdmUnLFxuICAgICAgfSwgc2NvcGUpXG4gICAgfVxuICB9KVxuXG4gIGludGVyYWN0aW9ucy5zaWduYWxzLm9uKCdkb3duJywgKHsgaW50ZXJhY3Rpb24sIHBvaW50ZXIsIGV2ZW50LCBldmVudFRhcmdldCwgcG9pbnRlckluZGV4IH0pID0+IHtcbiAgICBjb25zdCB0aW1lciA9IGludGVyYWN0aW9uLnBvaW50ZXJzW3BvaW50ZXJJbmRleF0uaG9sZFxuICAgIGNvbnN0IHBhdGggPSB1dGlscy5kb20uZ2V0UGF0aChldmVudFRhcmdldClcbiAgICBjb25zdCBzaWduYWxBcmcgPSB7XG4gICAgICBpbnRlcmFjdGlvbixcbiAgICAgIHBvaW50ZXIsXG4gICAgICBldmVudCxcbiAgICAgIGV2ZW50VGFyZ2V0LFxuICAgICAgdHlwZTogJ2hvbGQnLFxuICAgICAgdGFyZ2V0czogW10gYXMgRXZlbnRUYXJnZXRMaXN0LFxuICAgICAgcGF0aCxcbiAgICAgIGVsZW1lbnQ6IG51bGwsXG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBlbGVtZW50IG9mIHBhdGgpIHtcbiAgICAgIHNpZ25hbEFyZy5lbGVtZW50ID0gZWxlbWVudFxuXG4gICAgICBzaWduYWxzLmZpcmUoJ2NvbGxlY3QtdGFyZ2V0cycsIHNpZ25hbEFyZylcbiAgICB9XG5cbiAgICBpZiAoIXNpZ25hbEFyZy50YXJnZXRzLmxlbmd0aCkgeyByZXR1cm4gfVxuXG4gICAgbGV0IG1pbkR1cmF0aW9uID0gSW5maW5pdHlcblxuICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHNpZ25hbEFyZy50YXJnZXRzKSB7XG4gICAgICBjb25zdCBob2xkRHVyYXRpb24gPSB0YXJnZXQuZXZlbnRhYmxlLm9wdGlvbnMuaG9sZER1cmF0aW9uXG5cbiAgICAgIGlmIChob2xkRHVyYXRpb24gPCBtaW5EdXJhdGlvbikge1xuICAgICAgICBtaW5EdXJhdGlvbiA9IGhvbGREdXJhdGlvblxuICAgICAgfVxuICAgIH1cblxuICAgIHRpbWVyLmR1cmF0aW9uID0gbWluRHVyYXRpb25cbiAgICB0aW1lci50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBmaXJlKHtcbiAgICAgICAgaW50ZXJhY3Rpb24sXG4gICAgICAgIGV2ZW50VGFyZ2V0LFxuICAgICAgICBwb2ludGVyLFxuICAgICAgICBldmVudCxcbiAgICAgICAgdHlwZTogJ2hvbGQnLFxuICAgICAgfSwgc2NvcGUpXG4gICAgfSwgbWluRHVyYXRpb24pXG4gIH0pXG5cbiAgZm9yIChjb25zdCBzaWduYWxOYW1lIG9mIFsndXAnLCAnY2FuY2VsJ10pIHtcbiAgICBpbnRlcmFjdGlvbnMuc2lnbmFscy5vbihzaWduYWxOYW1lLCAoeyBpbnRlcmFjdGlvbiwgcG9pbnRlckluZGV4IH0pID0+IHtcbiAgICAgIGlmIChpbnRlcmFjdGlvbi5wb2ludGVyc1twb2ludGVySW5kZXhdLmhvbGQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KGludGVyYWN0aW9uLnBvaW50ZXJzW3BvaW50ZXJJbmRleF0uaG9sZC50aW1lb3V0KVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHNpbXBsZVNpZ25hbHMubGVuZ3RoOyBpKyspIHtcbiAgICBpbnRlcmFjdGlvbnMuc2lnbmFscy5vbihzaW1wbGVTaWduYWxzW2ldLCBjcmVhdGVTaWduYWxMaXN0ZW5lcihzaW1wbGVFdmVudHNbaV0sIHNjb3BlKSlcbiAgfVxuXG4gIGludGVyYWN0aW9ucy5zaWduYWxzLm9uKCd1cCcsICh7IGludGVyYWN0aW9uLCBwb2ludGVyLCBldmVudCwgZXZlbnRUYXJnZXQgfSkgPT4ge1xuICAgIGlmICghaW50ZXJhY3Rpb24ucG9pbnRlcldhc01vdmVkKSB7XG4gICAgICBmaXJlKHsgaW50ZXJhY3Rpb24sIGV2ZW50VGFyZ2V0LCBwb2ludGVyLCBldmVudCwgdHlwZTogJ3RhcCcgfSwgc2NvcGUpXG4gICAgfVxuICB9KVxufVxuXG5mdW5jdGlvbiBjcmVhdGVTaWduYWxMaXN0ZW5lciAodHlwZTogc3RyaW5nLCBzY29wZSkge1xuICByZXR1cm4gZnVuY3Rpb24gKHsgaW50ZXJhY3Rpb24sIHBvaW50ZXIsIGV2ZW50LCBldmVudFRhcmdldCB9OiBhbnkpIHtcbiAgICBmaXJlKHsgaW50ZXJhY3Rpb24sIGV2ZW50VGFyZ2V0LCBwb2ludGVyLCBldmVudCwgdHlwZSB9LCBzY29wZSlcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBwb2ludGVyRXZlbnRzXG4iXX0=