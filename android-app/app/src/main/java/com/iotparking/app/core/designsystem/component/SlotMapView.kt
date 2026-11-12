package com.iotparking.app.core.designsystem.component

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.iotparking.app.R
import com.iotparking.app.core.designsystem.theme.SlotAvailable
import com.iotparking.app.core.designsystem.theme.SlotOccupied
import com.iotparking.app.core.designsystem.theme.SlotReserved
import com.iotparking.app.core.designsystem.theme.SlotSelected
import com.iotparking.app.core.domain.model.Slot
import com.iotparking.app.core.domain.model.SlotStatus

@Composable
fun SlotMapView(
    slots: List<Slot>,
    selectedSlotId: String? = null,
    onSlotClick: ((Slot) -> Unit)? = null,
    showNavigationHint: Boolean = true,
    highlightSlotId: String? = null,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Cổng vào (Gate Entrance Indicator)
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.primary)
                    .padding(horizontal = 24.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "CỔNG VÀO (BARIE)",
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onPrimary
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Navigation guide arrows
            if (showNavigationHint) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Rẽ Trái: Khu A",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Khu B: Rẽ Phải",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.Default.ArrowForward,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Sơ đồ 4 ô chia 2 cột: Khu A và Khu B
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Zone A (A1, A2)
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "KHU A",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    val slotA1 = slots.find { it.id.equals("A1", ignoreCase = true) } ?: Slot("A1", "A", false, SlotStatus.AVAILABLE, null, null, 0)
                    val slotA2 = slots.find { it.id.equals("A2", ignoreCase = true) } ?: Slot("A2", "A", false, SlotStatus.AVAILABLE, null, null, 0)

                    SlotItem(
                        slot = slotA1,
                        isSelected = selectedSlotId == slotA1.id,
                        isHighlighted = highlightSlotId == slotA1.id,
                        onClick = if (onSlotClick != null) { { onSlotClick(slotA1) } } else null
                    )
                    SlotItem(
                        slot = slotA2,
                        isSelected = selectedSlotId == slotA2.id,
                        isHighlighted = highlightSlotId == slotA2.id,
                        onClick = if (onSlotClick != null) { { onSlotClick(slotA2) } } else null
                    )
                }

                // Zone B (B1, B2)
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "KHU B",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    val slotB1 = slots.find { it.id.equals("B1", ignoreCase = true) } ?: Slot("B1", "B", false, SlotStatus.AVAILABLE, null, null, 0)
                    val slotB2 = slots.find { it.id.equals("B2", ignoreCase = true) } ?: Slot("B2", "B", false, SlotStatus.AVAILABLE, null, null, 0)

                    SlotItem(
                        slot = slotB1,
                        isSelected = selectedSlotId == slotB1.id,
                        isHighlighted = highlightSlotId == slotB1.id,
                        onClick = if (onSlotClick != null) { { onSlotClick(slotB1) } } else null
                    )
                    SlotItem(
                        slot = slotB2,
                        isSelected = selectedSlotId == slotB2.id,
                        isHighlighted = highlightSlotId == slotB2.id,
                        onClick = if (onSlotClick != null) { { onSlotClick(slotB2) } } else null
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Legend
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                LegendItem(color = SlotAvailable, label = "Trống")
                LegendItem(color = SlotOccupied, label = "Đang đỗ")
                LegendItem(color = SlotReserved, label = "Đã đặt")
            }
        }
    }
}

@Composable
private fun SlotItem(
    slot: Slot,
    isSelected: Boolean,
    isHighlighted: Boolean,
    onClick: (() -> Unit)?
) {
    val backgroundColor = when {
        isSelected -> SlotSelected
        isHighlighted -> SlotSelected
        slot.status == SlotStatus.OCCUPIED -> SlotOccupied
        slot.status == SlotStatus.RESERVED -> SlotReserved
        else -> SlotAvailable
    }

    val isClickable = onClick != null && slot.status == SlotStatus.AVAILABLE

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(72.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(backgroundColor.copy(alpha = if (isSelected || isHighlighted) 0.95f else 0.85f))
            .then(
                if (isSelected || isHighlighted) {
                    Modifier.border(BorderStroke(3.dp, Color.White), RoundedCornerShape(12.dp))
                } else Modifier
            )
            .then(if (isClickable) Modifier.clickable { onClick?.invoke() } else Modifier),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = slot.id,
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp
                ),
                color = Color.White
            )
            when (slot.status) {
                SlotStatus.OCCUPIED -> {
                    Icon(
                        imageVector = Icons.Default.DirectionsCar,
                        contentDescription = "Occupied",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }
                SlotStatus.RESERVED -> {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "Reserved",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }
                SlotStatus.AVAILABLE -> {
                    Text(
                        text = if (isSelected) "Đã chọn" else "Trống",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White
                    )
                }
            }
        }
    }
}

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(color)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

