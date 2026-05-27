# 📐 Mathematical Engine & Core Physics

The Visual Gear Pair Calculator relies on strict gear kinematics formulas to compute dimensions, verify interference, and analyze mechanical stresses.

---

## 1. Operating Pressure Angle & Center Distance Solver

When gears have profile shifts ($x_1, x_2$) or are placed at a non-standard center distance ($a_w$), the operating pressure angle ($\alpha_w$) deviates from the reference pressure angle ($\alpha$).

The mathematical relationship is defined by:
$$\text{inv}(\alpha_w) = 2 \cdot \left(\frac{x_1 + x_2}{z_1 + z_2}\right) \cdot \tan(\alpha) + \text{inv}(\alpha)$$

where the involute function is:
$$\text{inv}(\theta) = \tan(\theta) - \theta$$

Since this equation is transcendental, the solver in `spurGeometry.ts` uses the **Newton-Raphson method** to approximate $\alpha_w$:
$$\theta_{n+1} = \theta_n - \frac{\text{inv}(\theta_n) - \text{inv}(\alpha_w)}{\tan^2(\theta_n)}$$

Once $\alpha_w$ is found, the operating center distance is computed as:
$$a_w = a \cdot \frac{\cos(\alpha)}{\cos(\alpha_w)}$$
where $a = \frac{m(z_1 + z_2)}{2}$ is the reference center distance.

---

## 2. Involute Curve Generation

Gears are plotted in 2D by generating polar/cartesian coordinates for the tooth shape. The profile consists of three sections:
1.  **Involute Curve**: Starting from the base circle radius $r_b$ up to the tip radius $r_a$.
2.  **Radial Line**: Plotted from base circle $r_b$ down to the root circle $r_f$ if $r_f < r_b$.
3.  **Fillet/Root Arc**: Smoothed connection to the root diameter.

The involute coordinates are parameterized by roll angle $\phi$:
$$x(\phi) = r_b \cdot (\cos(\phi) + \phi \cdot \sin(\phi))$$
$$y(\phi) = r_b \cdot (\sin(\phi) - \phi \cdot \cos(\phi))$$

For a given roll angle, the profile is rotated by the tooth thickness angle at the base circle to orient the teeth correctly around the center.

---

## 3. Forces & Torque

From the input power ($P$) and pinion speed ($n_1$ in RPM), we calculate input torque ($T_1$):
$$T_1 = \frac{9550 \cdot P}{n_1} \quad \text{[N·m]}$$

The forces acting on the tooth contact point are:
1.  **Tangential Force ($F_t$)**:
    $$F_t = \frac{2000 \cdot T_1}{d_{w1}} \quad \text{[N]}$$
2.  **Radial Force ($F_r$)**:
    $$F_r = F_t \cdot \tan(\alpha_w) \quad \text{[N]}$$
3.  **Normal Force ($F_n$)**:
    $$F_n = \frac{F_t}{\cos(\alpha_w)} \quad \text{[N]}$$

---

## 4. Lewis Tooth Strength Analysis

To perform preliminary stress checks, the engine implements the Lewis bending stress formula:
$$\sigma = \frac{F_t}{b \cdot m \cdot Y}$$

where:
*   $\sigma$ is the bending stress [MPa]
*   $b$ is the gear face width [mm]
*   $m$ is the module [mm]
*   $Y$ is the Lewis form factor, calculated based on the tooth count $z$:
    $$Y = \pi \cdot y$$
    $$y \approx 0.154 - \frac{0.912}{z} \quad \text{(for standard } 20^\circ \text{ pressure angle gears)}$$

The safety factor is evaluated against the material's yield strength ($\sigma_y$):
$$S_f = \frac{\sigma_y}{\sigma}$$

---

## 5. Geometric Validation Checkpoints

To ensure the physical viability of the system, the engine checks:
1.  **Undercutting**: Occurs if $z < \frac{2}{\sin^2(\alpha)}$. For $\alpha = 20^\circ$, $z_{min} \approx 17$. If $z < 17$, a profile shift $x \ge \frac{17 - z}{17}$ is recommended.
2.  **Contact Ratio ($g_\alpha$)**: The average number of teeth in contact must be greater than $1.0$ (ideally $g_\alpha \ge 1.2$) to ensure continuous rotation:
    $$g_\alpha = \frac{\sqrt{r_{a1}^2 - r_{b1}^2} + \sqrt{r_{a2}^2 - r_{b2}^2} - a_w \cdot \sin(\alpha_w)}{\pi \cdot m \cdot \cos(\alpha)}$$
3.  **Shaft/Bore Collision**: Pinion and gear bores must be small enough to leave sufficient tooth hub thickness.
