'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoyaltyProvider = LoyaltyProvider;
exports.useLoyaltyContext = useLoyaltyContext;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const LoyaltyContext = (0, react_1.createContext)({});
function LoyaltyProvider({ children, ...value }) {
    return (0, jsx_runtime_1.jsx)(LoyaltyContext.Provider, { value: value, children: children });
}
function useLoyaltyContext() {
    return (0, react_1.useContext)(LoyaltyContext);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG95YWx0eS1jb250ZXh0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3N0b3JlZnJvbnQvY29udGV4dC9sb3lhbHR5LWNvbnRleHQudHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFlBQVksQ0FBQzs7O0FBd0NiLDBDQUVDO0FBRUQsOENBRUM7O0FBM0NELGlDQUFrRDtBQStCbEQsTUFBTSxjQUFjLEdBQUcsSUFBQSxxQkFBYSxFQUFzQixFQUFFLENBQUMsQ0FBQztBQU05RCxTQUFnQixlQUFlLENBQUMsRUFBRSxRQUFRLEVBQUUsR0FBRyxLQUFLLEVBQXdCO0lBQzFFLE9BQU8sdUJBQUMsY0FBYyxDQUFDLFFBQVEsSUFBQyxLQUFLLEVBQUUsS0FBSyxZQUFHLFFBQVEsR0FBMkIsQ0FBQztBQUNyRixDQUFDO0FBRUQsU0FBZ0IsaUJBQWlCO0lBQy9CLE9BQU8sSUFBQSxrQkFBVSxFQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQ3BDLENBQUMifQ==