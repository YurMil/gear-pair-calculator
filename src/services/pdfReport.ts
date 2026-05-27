import { jsPDF } from 'jspdf';
import type { CalculationResult } from '../domain/types';

export function generatePdfReport(result: CalculationResult, includeLayoutDrawing: boolean = false): Blob {
  const { metadata, gearInput, loadInput, materialInput, geometry, forces, strength } = result;
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let y = 20;

  // Helper to add clean section headers
  const addSectionHeader = (title: string) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(30, 41, 59); // deep slate
    doc.rect(14, y, 182, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), 18, y + 5);
    y += 12;
  };

  // Helper to add metadata row
  const addMetaRow = (label1: string, val1: string, label2: string, val2: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    doc.text(label1, 14, y);
    doc.text(label2, 110, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    doc.text(val1 || '-', 45, y);
    doc.text(val2 || '-', 145, y);
    y += 6;
  };

  // Cover block
  doc.setFillColor(15, 23, 42); // very dark slate
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(34, 211, 238); // neon cyan
  doc.text('CAD AUTOSCRIPT', 14, 18);
  
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('Visual Gear Pair Sizing & Verification Report', 14, 28);
  
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(`Generated: ${metadata.date} | Version: 1.0.0`, 150, 28);

  y = 50;

  // 1. Project Information
  addSectionHeader('Project Context');
  addMetaRow('Project Name:', metadata.projectName, 'Date:', metadata.date);
  addMetaRow('Lead Engineer:', metadata.engineerName, 'Compliance:', 'ISO 21771-1:2024 Geometry');
  addMetaRow('Pinion Part No:', metadata.pinionPartNum, 'Gear Part No:', metadata.gearPartNum);
  y += 5;

  // 2. Sizing Parameters
  addSectionHeader('Input Parameters');
  addMetaRow('Module (m):', `${gearInput.module} mm`, 'Pressure Angle:', `${gearInput.pressureAngle} deg`);
  addMetaRow('Pinion Teeth (z1):', `${gearInput.z1}`, 'Gear Teeth (z2):', `${gearInput.z2}`);
  addMetaRow('Pinion Shift (x1):', `${gearInput.x1.toFixed(3)}`, 'Gear Shift (x2):', `${gearInput.x2.toFixed(3)}`);
  addMetaRow('Face Width (b):', `${gearInput.faceWidth} mm`, 'Backlash (j):', `${gearInput.backlash} mm`);
  addMetaRow('Input Speed (n1):', `${loadInput.speed1} rpm`, 'Input Torque (T1):', `${loadInput.torque1} N*m`);
  addMetaRow('Pinion Material:', materialInput.material1, 'Gear Material:', materialInput.material2);
  y += 5;

  // 3. Calculated Sizing Geometry
  addSectionHeader('Calculated Geometry');
  
  // Table header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setFillColor(243, 244, 246);
  doc.rect(14, y, 182, 6, 'F');
  doc.setTextColor(75, 85, 99);
  doc.text('Parameter Name', 16, y + 4.5);
  doc.text('Symbol', 80, y + 4.5);
  doc.text('Pinion (Gear 1)', 110, y + 4.5);
  doc.text('Gear (Gear 2)', 155, y + 4.5);
  y += 9;

  const addGeomRow = (name: string, symbol: string, pVal: string, gVal: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(17, 24, 39);
    doc.text(name, 16, y);
    doc.setFont('helvetica', 'italic');
    doc.text(symbol, 80, y);
    doc.setFont('helvetica', 'normal');
    doc.text(pVal, 110, y);
    doc.text(gVal, 155, y);
    doc.setDrawColor(229, 231, 235);
    doc.line(14, y + 1.5, 196, y + 1.5);
    y += 5.5;
  };

  addGeomRow('Pitch Diameter', 'd', `${geometry.pinion.d.toFixed(3)} mm`, `${geometry.gear.d.toFixed(3)} mm`);
  addGeomRow('Base Diameter', 'db', `${geometry.pinion.db.toFixed(3)} mm`, `${geometry.gear.db.toFixed(3)} mm`);
  addGeomRow('Outside (Addendum) Dia', 'da', `${geometry.pinion.da.toFixed(3)} mm`, `${geometry.gear.da.toFixed(3)} mm`);
  addGeomRow('Root (Dedendum) Diameter', 'df', `${geometry.pinion.df.toFixed(3)} mm`, `${geometry.gear.df.toFixed(3)} mm`);
  addGeomRow('Tooth Thickness at Pitch', 's', `${geometry.pinion.s.toFixed(3)} mm`, `${geometry.gear.s.toFixed(3)} mm`);
  addGeomRow('Addendum Height', 'ha', `${geometry.pinion.ha.toFixed(3)} mm`, `${geometry.gear.ha.toFixed(3)} mm`);
  addGeomRow('Dedendum Height', 'hf', `${geometry.pinion.hf.toFixed(3)} mm`, `${geometry.gear.hf.toFixed(3)} mm`);
  addGeomRow('Estimated Gear Mass', 'mass', `${geometry.pinion.mass.toFixed(2)} kg`, `${geometry.gear.mass.toFixed(2)} kg`);
  y += 5;

  // 4. Mesh Quality & Limits
  addSectionHeader('Mesh Quality & Engagement Bounds');
  addMetaRow('Standard Center Dist:', `${geometry.a.toFixed(3)} mm`, 'Operating Center Dist (aw):', `${geometry.aw.toFixed(3)} mm`);
  addMetaRow('Center Dist Shift (y):', `${geometry.y.toFixed(3)}`, 'Tip Reduction Shift (dy):', `${geometry.deltaY.toFixed(3)}`);
  addMetaRow('Operating Pressure Angle:', `${geometry.alphaW.toFixed(3)} deg`, 'Transverse Contact Ratio:', `${geometry.contactRatio.toFixed(3)}`);
  y += 5;

  // Next page for forces, safety, and appendix
  doc.addPage();
  y = 20;

  // 5. Kinematics & Force Results
  addSectionHeader('Kinematics & Load Force Breakdown');
  addMetaRow('Rotational Ratio (i):', `${geometry.ratio.toFixed(3)}`, 'Pitch Velocity (v):', `${forces.v.toFixed(2)} m/s`);
  addMetaRow('Pinion Torque (T1):', `${loadInput.torque1} N*m`, 'Estimated Output Torque (T2):', `${forces.Ft > 0 ? (loadInput.torque1 * geometry.ratio * loadInput.efficiency).toFixed(1) : '0'} N*m`);
  addMetaRow('Power Transmitted (P):', `${forces.power.toFixed(2)} kW`, 'Pinion speed (n1):', `${loadInput.speed1} rpm`);
  addMetaRow('Tangential Force (Ft):', `${forces.Ft.toFixed(1)} N`, 'Radial Separation Force (Fr):', `${forces.Fr.toFixed(1)} N`);
  addMetaRow('Normal Mesh Force (Fn):', `${forces.Fn.toFixed(1)} N`, 'Service Safety Factor (KA):', `${loadInput.serviceFactor}`);
  y += 5;

  // 6. Bending Stress Checks
  addSectionHeader('Preliminary Tooth Bending Verification');
  addMetaRow('Pinion Bending Stress:', `${strength.pinionBendingStress.toFixed(1)} MPa`, 'Gear Bending Stress:', `${strength.gearBendingStress.toFixed(1)} MPa`);
  addMetaRow('Allowable Bending (P):', `${materialInput.allowableBending1} MPa`, 'Allowable Bending (G):', `${materialInput.allowableBending2} MPa`);
  addMetaRow('Pinion Safety Factor:', strength.pinionSafetyFactor > 99 ? 'No Load' : strength.pinionSafetyFactor.toFixed(2), 'Gear Safety Factor:', strength.gearSafetyFactor > 99 ? 'No Load' : strength.gearSafetyFactor.toFixed(2));
  y += 5;

  // 7. Validation Warnings List
  addSectionHeader('Engineering Check Summary');
  const issues = result.issues;
  if (issues.length === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // green
    doc.text('PASS: No critical engineering errors or warnings flagged.', 14, y);
    y += 10;
  } else {
    issues.forEach((issue) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      if (issue.severity === 'error') {
        doc.setTextColor(244, 63, 94); // red
        doc.text(`[ERROR] ${issue.title}`, 14, y);
      } else if (issue.severity === 'warning') {
        doc.setTextColor(245, 158, 11); // amber
        doc.text(`[WARNING] ${issue.title}`, 14, y);
      } else {
        doc.setTextColor(34, 211, 238); // cyan
        doc.text(`[INFO] ${issue.title}`, 14, y);
      }
      y += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 65, 81);
      const splitMsg = doc.splitTextToSize(issue.message, 175);
      doc.text(splitMsg, 16, y);
      y += splitMsg.length * 4.5 + 2;
    });
  }
  y += 5;

  // 8. Formula Appendix
  addSectionHeader('Calculation Appendix & Math Derivations');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  
  const addFormulaLine = (textLine: string) => {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(textLine, 14, y);
    y += 4.5;
  };

  addFormulaLine('1. Pitch diameter: d = m * z');
  addFormulaLine('2. Base diameter: db = d * cos(alpha)');
  addFormulaLine('3. Standard center distance: a = (d1 + d2) / 2');
  addFormulaLine('4. Operating pressure angle (alpha_w) is solved numerically from:');
  addFormulaLine('   inv(alpha_w) = inv(alpha) + 2 * tan(alpha) * (x1 + x2) / (z1 + z2)');
  addFormulaLine('5. Operating center distance: aw = a * cos(alpha) / cos(alpha_w)');
  addFormulaLine('6. Center distance modification coefficient: y = (aw - a) / m');
  addFormulaLine('7. Tip reduction coefficient: deltaY = (x1 + x2) - y');
  addFormulaLine('8. Addenda: ha = (ha_star + x - deltaY) * m. Dedenda: hf = (hf_star - x) * m');
  addFormulaLine('9. Outside diameter: da = d + 2 * ha. Root diameter: df = d - 2 * hf');
  addFormulaLine('10. Transverse contact ratio:');
  addFormulaLine('    epsilon_alpha = [sqrt(ra1^2 - rb1^2) + sqrt(ra2^2 - rb2^2) - aw * sin(alpha_w)] / (pi * m * cos(alpha))');
  addFormulaLine('11. Linear pitch-line velocity: v = pi * dw1 * n1 / 60000');
  addFormulaLine('12. Tangential force: Ft = 2 * T1 * 1000 / dw1. Radial force: Fr = Ft * tan(alpha_w)');
  addFormulaLine('13. Preliminary root bending stress (Lewis check):');
  addFormulaLine('    sigma_b = Ft * KA / (b * m * Y_m), where Y_m = pi * y_base * (1 + 1.2 * x)');
  addFormulaLine('    y_base is the Lewis coefficient: 0.154 - 0.912/z (for 20 deg pressure angle)');
  
  y += 5;
  addSectionHeader('Legal & Engineering Disclaimers');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(244, 63, 94);
  doc.text('IMPORTANT CERTIFICATION NOTE:', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  const disclaimer = 'This report provides a preliminary check of cylindrical involute spur gears. The bending stress calculations use a simplified Lewis formula rather than a full ISO 6336 or AGMA 2001 rating. It is the responsibility of the mechanical designer to verify final layouts, fatigue margins, pitting safety, and dynamic loading factors against licensed standards before placing components into service.';
  const splitDisclaimer = doc.splitTextToSize(disclaimer, 180);
  doc.text(splitDisclaimer, 14, y);

  if (includeLayoutDrawing) {
    drawGearLayout(doc, result);
  }

  return doc.output('blob');
}

import { generateGearProfile } from '../domain/involute';

function drawGearLayout(doc: jsPDF, result: CalculationResult) {
  doc.addPage();
  doc.setFillColor(30, 41, 59);
  doc.rect(14, 20, 182, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('GEAR SYSTEM LAYOUT DRAWING', 18, 25);

  const { geometry, gearInput } = result;
  
  const da1 = geometry.pinion.da;
  const da2 = geometry.gear.da;
  const aw = geometry.aw;
  const totalWidth = aw + (da1 + da2) / 2;
  const totalHeight = Math.max(da1, da2);
  
  const scale = Math.min(170 / totalWidth, 180 / totalHeight);
  
  const centerX1 = 105 - (aw * scale) / 2;
  const centerY = 120;
  const centerX2 = centerX1 + (aw * scale);
  
  const points1 = generateGearProfile(
    geometry.pinion.z, geometry.pinion.m, gearInput.pressureAngle, 
    gearInput.x1, gearInput.addendumCoeff, gearInput.dedendumCoeff, 
    geometry.deltaY, 10, 4
  );
  const points2 = generateGearProfile(
    geometry.gear.z, geometry.gear.m, gearInput.pressureAngle, 
    gearInput.x2, gearInput.addendumCoeff, gearInput.dedendumCoeff, 
    geometry.deltaY, 10, 4
  );
  
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  
  // Pinion
  for(let i=0; i<points1.length; i++) {
     const p1 = points1[i];
     const p2 = points1[(i+1)%points1.length];
     doc.line(centerX1 + p1.x * scale, centerY - p1.y * scale, centerX1 + p2.x * scale, centerY - p2.y * scale);
  }
  
  // Gear
  const angleTooth2 = (2 * Math.PI) / geometry.gear.z;
  const phase2 = Math.PI + angleTooth2 / 2;
  
  for(let i=0; i<points2.length; i++) {
     const p1 = points2[i];
     const p2 = points2[(i+1)%points2.length];
     
     const x1 = p1.x * Math.cos(phase2) - p1.y * Math.sin(phase2);
     const y1 = p1.x * Math.sin(phase2) + p1.y * Math.cos(phase2);
     
     const x2 = p2.x * Math.cos(phase2) - p2.y * Math.sin(phase2);
     const y2 = p2.x * Math.sin(phase2) + p2.y * Math.cos(phase2);
     
     doc.line(centerX2 + x1 * scale, centerY - y1 * scale, centerX2 + x2 * scale, centerY - y2 * scale);
  }

  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.2);
  doc.setLineDash([2, 2], 0);
  doc.line(centerX1, centerY, centerX2, centerY);
  
  // Bores
  if (gearInput.bore1 > 0) {
      doc.circle(centerX1, centerY, (gearInput.bore1/2) * scale);
  }
  if (gearInput.bore2 > 0) {
      doc.circle(centerX2, centerY, (gearInput.bore2/2) * scale);
  }
  
  doc.setLineDash([], 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text(`Center Distance (aw) = ${geometry.aw.toFixed(3)} mm`, 105, centerY + (totalHeight/2)*scale + 10, { align: 'center' });
  doc.text(`Pinion Outside (da1) = ${geometry.pinion.da.toFixed(3)} mm`, centerX1, centerY + (da1/2)*scale + 5, { align: 'center' });
  doc.text(`Gear Outside (da2) = ${geometry.gear.da.toFixed(3)} mm`, centerX2, centerY + (da2/2)*scale + 5, { align: 'center' });
}

export function downloadPdf(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
